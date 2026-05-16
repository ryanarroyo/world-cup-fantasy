-- H2H Draft Mode — Phase 6: per-team status helper for the tournament UI.
-- Returns each drafted team in a league with its current locked/projected
-- depth labels and an alive flag. Client uses this to bucket teams into
-- "still alive" vs "eliminated" lists and to color-code the bracket.

begin;

create or replace function h2h_team_statuses(p_league_id uuid)
returns table (
  team_id int,
  user_id uuid,
  pick_number int,
  locked_depth text,
  projected_depth text,
  alive boolean,
  team_goals int
)
language sql
stable
as $$
  with picks as (
    select team_id, user_id, pick_number
    from h2h_draft_picks
    where league_id = p_league_id
  )
  select
    p.team_id,
    p.user_id,
    p.pick_number,
    h2h_team_locked_depth(p.team_id) as locked_depth,
    h2h_team_projected_depth(p.team_id) as projected_depth,
    h2h_team_alive(p.team_id, h2h_team_locked_depth(p.team_id)) as alive,
    h2h_team_goals(p.team_id) as team_goals
  from picks p;
$$;

commit;
