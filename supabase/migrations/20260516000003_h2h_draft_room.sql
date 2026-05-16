-- H2H Draft Mode — Phase 4: draft-room RPCs (make pick, auto-pick, cancel).

begin;

-- Cancel-request state for the mutual-cancel-within-6-picks affordance.
alter table h2h_drafts
  add column cancel_requested_by uuid references profiles(id);

-- ---------------------------------------------------------------------------
-- Pick-owner helpers
-- ---------------------------------------------------------------------------
-- Snake order: P1 P2 / P2 P1 / P1 P2 / P2 P1 ...
-- Rule (1-indexed pick number n): (n / 2) % 2 = 0 → first picker, else second.

create or replace function h2h_pick_owner_label(p_pick_number int)
returns text
language sql
immutable
as $$
  select case when (p_pick_number / 2) % 2 = 0 then 'first' else 'second' end;
$$;

create or replace function h2h_pick_owner_user(
  p_league_id uuid,
  p_pick_number int
) returns uuid
language plpgsql
stable
as $$
declare
  v_first uuid;
  v_other uuid;
begin
  select first_pick_user_id into v_first
  from h2h_drafts where league_id = p_league_id;
  if v_first is null then
    return null;
  end if;

  select user_id into v_other
  from league_members
  where league_id = p_league_id and user_id <> v_first
  limit 1;

  if h2h_pick_owner_label(p_pick_number) = 'first' then
    return v_first;
  else
    return v_other;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Make a pick (manual)
-- ---------------------------------------------------------------------------

create or replace function h2h_make_pick(
  p_league_id uuid,
  p_team_id int
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_draft h2h_drafts;
  v_expected_user uuid;
  v_taken_count int;
begin
  if v_caller is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_draft from h2h_drafts where league_id = p_league_id for update;
  if v_draft.league_id is null then
    raise exception 'Draft not found';
  end if;
  if v_draft.status <> 'DRAFTING' then
    raise exception 'Draft is not in progress';
  end if;
  if v_draft.current_pick_number < 1 or v_draft.current_pick_number > 48 then
    raise exception 'Draft is complete';
  end if;

  v_expected_user := h2h_pick_owner_user(p_league_id, v_draft.current_pick_number);
  if v_expected_user is null or v_expected_user <> v_caller then
    raise exception 'Not your turn';
  end if;

  select count(*) into v_taken_count
  from h2h_draft_picks
  where league_id = p_league_id and team_id = p_team_id;
  if v_taken_count > 0 then
    raise exception 'Team already picked';
  end if;

  insert into h2h_draft_picks
    (league_id, pick_number, user_id, team_id, was_autopick)
  values
    (p_league_id, v_draft.current_pick_number, v_caller, p_team_id, false);

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

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Auto-pick on timer expiry
-- ---------------------------------------------------------------------------
-- Idempotent. Safe to call from any league member. Inspects the timer
-- before doing anything so multiple calls collapse to one pick.

create or replace function h2h_autopick_if_expired(
  p_league_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft h2h_drafts;
  v_expected_user uuid;
  v_team_id int;
begin
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

-- ---------------------------------------------------------------------------
-- Cancel draft
-- ---------------------------------------------------------------------------
-- LOBBY: any member can cancel immediately.
-- DRAFTING (pick <= 6): mutual — first caller "requests"; second caller
--   confirms; the original caller can also withdraw their own request.
-- Otherwise: error.

create or replace function h2h_cancel_draft(
  p_league_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_draft h2h_drafts;
  v_is_member int;
begin
  if v_caller is null then
    raise exception 'Not authenticated';
  end if;

  select count(*) into v_is_member
  from league_members
  where league_id = p_league_id and user_id = v_caller;
  if v_is_member = 0 then
    raise exception 'Not a member of this league';
  end if;

  select * into v_draft from h2h_drafts where league_id = p_league_id for update;
  if v_draft.league_id is null then
    raise exception 'Draft not found';
  end if;

  if v_draft.status = 'LOBBY' then
    update h2h_drafts
    set status = 'CANCELLED',
        cancel_requested_by = null,
        updated_at = now()
    where league_id = p_league_id;
    return jsonb_build_object('ok', true, 'cancelled', true);
  end if;

  if v_draft.status = 'DRAFTING' and v_draft.current_pick_number <= 6 then
    if v_draft.cancel_requested_by is null then
      update h2h_drafts
      set cancel_requested_by = v_caller, updated_at = now()
      where league_id = p_league_id;
      return jsonb_build_object('ok', true, 'requested', true);
    end if;

    if v_draft.cancel_requested_by = v_caller then
      update h2h_drafts
      set cancel_requested_by = null, updated_at = now()
      where league_id = p_league_id;
      return jsonb_build_object('ok', true, 'withdrawn', true);
    end if;

    update h2h_drafts
    set status = 'CANCELLED',
        cancel_requested_by = null,
        updated_at = now()
    where league_id = p_league_id;
    return jsonb_build_object('ok', true, 'cancelled', true);
  end if;

  raise exception 'Cancellation not allowed in current state';
end;
$$;

commit;
