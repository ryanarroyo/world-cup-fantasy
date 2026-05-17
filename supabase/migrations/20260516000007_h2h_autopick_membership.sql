-- H2H Draft Mode — review follow-up: require league membership for
-- h2h_autopick_if_expired. The RPC is idempotent so the prior exposure
-- was limited to timing probes against arbitrary leagues; this closes
-- that gap as defense in depth.

begin;

create or replace function h2h_autopick_if_expired(
  p_league_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_draft h2h_drafts;
  v_expected_user uuid;
  v_team_id int;
begin
  if v_caller is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  if not exists (
    select 1 from league_members
    where league_id = p_league_id and user_id = v_caller
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not_a_member');
  end if;

  select * into v_draft from h2h_drafts where league_id = p_league_id for update;
  if v_draft.league_id is null or v_draft.status <> 'DRAFTING' then
    return jsonb_build_object('ok', false, 'reason', 'not_drafting');
  end if;
  if v_draft.current_turn_started_at is null
     or now() < v_draft.current_turn_started_at + interval '60 seconds' then
    return jsonb_build_object('ok', false, 'reason', 'not_expired');
  end if;

  v_expected_user := h2h_pick_owner_user(p_league_id, v_draft.current_pick_number);
  if v_expected_user is null then
    return jsonb_build_object('ok', false, 'reason', 'no_user');
  end if;

  -- 1. Highest-priority entry in the player's autopick queue that hasn't
  --    already been taken.
  select aq.team_id into v_team_id
  from h2h_autopick_queue aq
  where aq.league_id = p_league_id
    and aq.user_id = v_expected_user
    and not exists (
      select 1 from h2h_draft_picks p
      where p.league_id = p_league_id and p.team_id = aq.team_id
    )
  order by aq.priority asc
  limit 1;

  -- 2. Fall back to lowest fifa_rank (best team) remaining.
  if v_team_id is null then
    select t.id into v_team_id
    from teams t
    where t.fifa_rank is not null
      and not exists (
        select 1 from h2h_draft_picks p
        where p.league_id = p_league_id and p.team_id = t.id
      )
    order by t.fifa_rank asc, t.id asc
    limit 1;
  end if;

  -- 3. Last resort: any unranked remaining team.
  if v_team_id is null then
    select t.id into v_team_id
    from teams t
    where not exists (
      select 1 from h2h_draft_picks p
      where p.league_id = p_league_id and p.team_id = t.id
    )
    order by t.id asc
    limit 1;
  end if;

  if v_team_id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_teams');
  end if;

  insert into h2h_draft_picks
    (league_id, pick_number, user_id, team_id, was_autopick)
  values
    (p_league_id, v_draft.current_pick_number, v_expected_user, v_team_id, true);

  if v_draft.current_pick_number >= 48 then
    update h2h_drafts
    set status = 'COMPLETE',
        current_turn_started_at = null,
        updated_at = now()
    where league_id = p_league_id;
  else
    update h2h_drafts
    set current_pick_number = current_pick_number + 1,
        current_turn_started_at = now(),
        updated_at = now()
    where league_id = p_league_id;
  end if;

  return jsonb_build_object('ok', true, 'team_id', v_team_id, 'autopick', true);
end;
$$;

commit;
