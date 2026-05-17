-- H2H Draft Mode — review follow-up: security + correctness fixes.
--
-- 1. h2h_maybe_expire_lobby no longer trusts a client-supplied cutoff and
--    now enforces caller membership. Cutoff is derived server-side from
--    the canonical tournament kickoff timestamp.
-- 2. h2h_team_locked_depth resolves the FINAL winner via penalty shootouts
--    when winner_team_id is NULL but home/away penalties are recorded.

begin;

-- Canonical tournament kickoff (must match src/lib/h2h/deadlines.ts).
create or replace function h2h_tournament_kickoff_at()
returns timestamptz
language sql
immutable
as $$
  select '2026-06-11 16:00:00+00'::timestamptz;
$$;

-- ---------------------------------------------------------------------------
-- 1. Lock down lobby expiry
-- ---------------------------------------------------------------------------
-- Old signature took a client-supplied p_cutoff, which let any league
-- member force-cancel a LOBBY draft by passing a cutoff in the past.

drop function if exists h2h_maybe_expire_lobby(uuid, timestamptz);

create or replace function h2h_maybe_expire_lobby(
  p_league_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_cutoff timestamptz := h2h_tournament_kickoff_at() - interval '24 hours';
begin
  if v_caller is null then
    return;
  end if;

  if not exists (
    select 1 from league_members
    where league_id = p_league_id and user_id = v_caller
  ) then
    return;
  end if;

  update h2h_drafts
  set status = 'CANCELLED',
      updated_at = now()
  where league_id = p_league_id
    and status = 'LOBBY'
    and now() >= v_cutoff;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Penalty-shootout fallback for the FINAL
-- ---------------------------------------------------------------------------
-- If the FINAL match is FINISHED with NULL winner_team_id but the penalty
-- columns disagree, resolve the champion from penalties. Same body as
-- the original function otherwise.

create or replace function h2h_team_locked_depth(p_team_id int)
returns text
language plpgsql
stable
as $$
declare
  v_max_ko int;
  v_final_status text;
  v_final_winner int;
  v_final_home int;
  v_final_away int;
  v_final_home_pens int;
  v_final_away_pens int;
  v_team_group text;
  v_group_done int;
begin
  select max(h2h_round_ord(round)) into v_max_ko
  from matches
  where round in ('R32','R16','QF','SF','FINAL')
    and (home_team_id = p_team_id or away_team_id = p_team_id);

  if v_max_ko = 5 then
    select
      status, winner_team_id,
      home_team_id, away_team_id,
      home_penalties, away_penalties
    into
      v_final_status, v_final_winner,
      v_final_home, v_final_away,
      v_final_home_pens, v_final_away_pens
    from matches where round = 'FINAL' limit 1;

    if v_final_status = 'FINISHED' then
      if v_final_winner is not null then
        if v_final_winner = p_team_id then
          return 'CHAMPION';
        else
          return 'FINAL';
        end if;
      end if;

      -- No winner_team_id recorded; fall back to penalty result.
      if v_final_home_pens is not null
         and v_final_away_pens is not null
         and v_final_home_pens <> v_final_away_pens then
        if (v_final_home_pens > v_final_away_pens
              and v_final_home = p_team_id)
           or (v_final_away_pens > v_final_home_pens
                 and v_final_away = p_team_id) then
          return 'CHAMPION';
        else
          return 'FINAL';
        end if;
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

commit;
