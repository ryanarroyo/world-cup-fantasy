-- H2H Draft Mode — Phase 5: scoring functions + triggers.
-- Curve B (cumulative): R32=2, R16=6, QF=14, SF=26, FINAL=42, CHAMPION=62.

begin;

-- ---------------------------------------------------------------------------
-- Pure helpers
-- ---------------------------------------------------------------------------

create or replace function h2h_round_ord(p_round text)
returns int
language sql
immutable
as $$
  select case p_round
    when 'GROUP' then 0
    when 'R32' then 1
    when 'R16' then 2
    when 'QF' then 3
    when 'SF' then 4
    when 'FINAL' then 5
    else -1
  end;
$$;

create or replace function h2h_cumulative_for_depth(p_depth text)
returns int
language sql
immutable
as $$
  select case p_depth
    when 'CHAMPION' then 62
    when 'FINAL' then 42
    when 'SF' then 26
    when 'QF' then 14
    when 'R16' then 6
    when 'R32' then 2
    else 0
  end;
$$;

-- Group rank by (pts desc, gd desc, gf desc, team_id) — deterministic.
-- FIFA tiebreakers beyond goal difference / goals scored (head-to-head, fair
-- play, draw) are not modelled in v1; ties at the cut line fall back to
-- team_id, which is arbitrary but stable.
create or replace function h2h_team_group_rank(
  p_group_letter text,
  p_team_id int
) returns int
language plpgsql
stable
as $$
declare
  v_rank int;
begin
  with team_results as (
    select
      t.id as team_id,
      coalesce(sum(case
        when m.status = 'FINISHED' and m.home_team_id = t.id and m.home_score > m.away_score then 3
        when m.status = 'FINISHED' and m.away_team_id = t.id and m.away_score > m.home_score then 3
        when m.status = 'FINISHED' and (m.home_team_id = t.id or m.away_team_id = t.id) and m.home_score = m.away_score then 1
        else 0
      end), 0) as pts,
      coalesce(sum(case
        when m.status = 'FINISHED' and m.home_team_id = t.id then m.home_score - m.away_score
        when m.status = 'FINISHED' and m.away_team_id = t.id then m.away_score - m.home_score
        else 0
      end), 0) as gd,
      coalesce(sum(case
        when m.status = 'FINISHED' and m.home_team_id = t.id then m.home_score
        when m.status = 'FINISHED' and m.away_team_id = t.id then m.away_score
        else 0
      end), 0) as gf
    from teams t
    left join matches m on m.round = 'GROUP'
      and (m.home_team_id = t.id or m.away_team_id = t.id)
    where t.group_letter = p_group_letter
    group by t.id
  ),
  ranked as (
    select team_id,
      row_number() over (order by pts desc, gd desc, gf desc, team_id) as rnk
    from team_results
  )
  select rnk into v_rank from ranked where team_id = p_team_id;
  return v_rank;
end;
$$;

-- Deepest round a team has *reached* with certainty.
-- Returns one of: CHAMPION / FINAL / SF / QF / R16 / R32 / NOT_ADVANCED / NULL.
-- NULL means the group stage isn't done yet — projection uses partial standings.
create or replace function h2h_team_locked_depth(p_team_id int)
returns text
language plpgsql
stable
as $$
declare
  v_max_ko int;
  v_final_status text;
  v_final_winner int;
  v_team_group text;
  v_group_done int;
begin
  select max(h2h_round_ord(round)) into v_max_ko
  from matches
  where round in ('R32','R16','QF','SF','FINAL')
    and (home_team_id = p_team_id or away_team_id = p_team_id);

  if v_max_ko = 5 then
    select status, winner_team_id into v_final_status, v_final_winner
    from matches where round = 'FINAL' limit 1;
    if v_final_status = 'FINISHED' then
      if v_final_winner = p_team_id then
        return 'CHAMPION';
      else
        return 'FINAL';
      end if;
    end if;
    return 'FINAL';
  elsif v_max_ko = 4 then return 'SF';
  elsif v_max_ko = 3 then return 'QF';
  elsif v_max_ko = 2 then return 'R16';
  elsif v_max_ko = 1 then return 'R32';
  end if;

  select group_letter into v_team_group from teams where id = p_team_id;
  if v_team_group is null then
    return 'NOT_ADVANCED';
  end if;

  select count(*) into v_group_done
  from matches
  where round = 'GROUP'
    and status = 'FINISHED'
    and group_letter = v_team_group;

  if v_group_done < 6 then
    return null;
  end if;

  if h2h_team_group_rank(v_team_group, p_team_id) <= 2 then
    return 'R32';
  else
    return 'NOT_ADVANCED';
  end if;
end;
$$;

-- Same as locked but falls back to current partial-group standings when the
-- group stage isn't yet complete. Never returns NULL — always a depth label.
create or replace function h2h_team_projected_depth(p_team_id int)
returns text
language plpgsql
stable
as $$
declare
  v_locked text;
  v_team_group text;
begin
  v_locked := h2h_team_locked_depth(p_team_id);
  if v_locked is not null then
    return v_locked;
  end if;

  select group_letter into v_team_group from teams where id = p_team_id;
  if v_team_group is null then
    return 'NOT_ADVANCED';
  end if;

  if h2h_team_group_rank(v_team_group, p_team_id) <= 2 then
    return 'R32';
  else
    return 'NOT_ADVANCED';
  end if;
end;
$$;

-- Total goals scored by a team across all FINISHED matches (for tiebreaker).
create or replace function h2h_team_goals(p_team_id int)
returns int
language sql
stable
as $$
  select coalesce(sum(case
    when m.home_team_id = p_team_id then m.home_score
    when m.away_team_id = p_team_id then m.away_score
    else 0
  end), 0)::int
  from matches m
  where m.status = 'FINISHED'
    and (m.home_team_id = p_team_id or m.away_team_id = p_team_id);
$$;

-- Alive iff still progressing. A team at depth X has been eliminated if
-- their match at round X is FINISHED (they didn't advance further).
create or replace function h2h_team_alive(p_team_id int, p_depth text)
returns boolean
language plpgsql
stable
as $$
begin
  if p_depth = 'CHAMPION' then return true; end if;
  if p_depth = 'NOT_ADVANCED' then return false; end if;
  if p_depth = 'FINAL' then
    return not exists (
      select 1 from matches m
      where m.round = 'FINAL' and m.status = 'FINISHED'
        and (m.home_team_id = p_team_id or m.away_team_id = p_team_id)
    );
  end if;
  if p_depth in ('R32','R16','QF','SF') then
    return not exists (
      select 1 from matches m
      where m.round = p_depth and m.status = 'FINISHED'
        and (m.home_team_id = p_team_id or m.away_team_id = p_team_id)
    );
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Main score computation
-- ---------------------------------------------------------------------------

create or replace function compute_h2h_score(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    with t as (
      select
        lm.user_id,
        p.team_id,
        h2h_team_locked_depth(p.team_id) as ld,
        h2h_team_projected_depth(p.team_id) as pd,
        h2h_team_goals(p.team_id) as tg
      from league_members lm
      join h2h_draft_picks p
        on p.league_id = lm.league_id and p.user_id = lm.user_id
      where lm.league_id = p_league_id
    )
    select
      user_id,
      coalesce(sum(h2h_cumulative_for_depth(coalesce(ld, 'GROUP'))), 0)::int as locked,
      coalesce(sum(h2h_cumulative_for_depth(pd)), 0)::int as projected,
      coalesce(sum(case when ld = 'CHAMPION' then 1
                        when ld is null then 0
                        when ld = 'NOT_ADVANCED' then 0
                        when h2h_team_alive(team_id, ld) then 1 else 0
                   end), 0)::int as alive,
      coalesce(sum(case when ld = 'NOT_ADVANCED' then 1
                        when ld is null then 0
                        when ld = 'CHAMPION' then 0
                        when h2h_team_alive(team_id, ld) then 0 else 1
                   end), 0)::int as eliminated,
      bool_or(ld = 'CHAMPION') as champion,
      bool_or(ld = 'FINAL') as runner_up,
      coalesce(sum(case when ld in ('SF','FINAL','CHAMPION') then 1 else 0 end), 0)::int as sf_count,
      coalesce(sum(case when ld in ('QF','SF','FINAL','CHAMPION') then 1 else 0 end), 0)::int as qf_count,
      coalesce(sum(tg), 0)::int as goals
    from t
    group by user_id
  loop
    insert into h2h_scores (
      league_id, user_id, locked_points, projected_points,
      teams_alive, teams_eliminated,
      champion_owned, runner_up_owned, sf_teams_count, qf_teams_count,
      total_goals, updated_at
    ) values (
      p_league_id, r.user_id, r.locked, r.projected,
      r.alive, r.eliminated,
      coalesce(r.champion, false), coalesce(r.runner_up, false),
      r.sf_count, r.qf_count, r.goals, now()
    )
    on conflict (league_id, user_id) do update set
      locked_points = excluded.locked_points,
      projected_points = excluded.projected_points,
      teams_alive = excluded.teams_alive,
      teams_eliminated = excluded.teams_eliminated,
      champion_owned = excluded.champion_owned,
      runner_up_owned = excluded.runner_up_owned,
      sf_teams_count = excluded.sf_teams_count,
      qf_teams_count = excluded.qf_teams_count,
      total_goals = excluded.total_goals,
      updated_at = excluded.updated_at;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
-- 1. On material match changes (status, winner, bracket assignment, score):
--    recompute scores for every H2H league whose drafted teams intersect this
--    match's teams (now or previously).

create or replace function h2h_on_match_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select distinct p.league_id
    from h2h_draft_picks p
    join leagues l on l.id = p.league_id
    where l.mode = 'H2H_DRAFT'
      and p.team_id in (
        new.home_team_id,
        new.away_team_id,
        old.home_team_id,
        old.away_team_id
      )
  loop
    perform compute_h2h_score(r.league_id);
  end loop;
  return new;
end;
$$;

drop trigger if exists h2h_match_change_trigger on matches;
create trigger h2h_match_change_trigger
after update on matches
for each row
when (
  old.status is distinct from new.status
  or old.winner_team_id is distinct from new.winner_team_id
  or old.home_team_id is distinct from new.home_team_id
  or old.away_team_id is distinct from new.away_team_id
  or old.home_score is distinct from new.home_score
  or old.away_score is distinct from new.away_score
)
execute function h2h_on_match_change();

-- 2. On every draft pick insert: keep the scoreboard row alive so the UI
--    has rows to render even before the tournament starts.

create or replace function h2h_on_pick_inserted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform compute_h2h_score(new.league_id);
  return new;
end;
$$;

drop trigger if exists h2h_pick_inserted_trigger on h2h_draft_picks;
create trigger h2h_pick_inserted_trigger
after insert on h2h_draft_picks
for each row execute function h2h_on_pick_inserted();

-- ---------------------------------------------------------------------------
-- Realtime publication
-- ---------------------------------------------------------------------------

do $$
begin
  begin
    alter publication supabase_realtime add table h2h_scores;
  exception when duplicate_object then null;
  end;
end$$;

commit;
