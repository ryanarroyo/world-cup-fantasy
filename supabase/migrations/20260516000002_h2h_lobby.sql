-- H2H Draft Mode — Phase 3: lobby ready-states, auto-start trigger,
-- realtime publication, lobby expiry helper.

begin;

-- ---------------------------------------------------------------------------
-- 1. Ready states
-- ---------------------------------------------------------------------------

create table h2h_ready_states (
  league_id uuid not null references leagues(id) on delete cascade,
  user_id uuid not null references profiles(id),
  ready_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

alter table h2h_ready_states enable row level security;

create policy h2h_ready_select_member on h2h_ready_states
  for select using (
    exists (
      select 1 from league_members
      where league_members.league_id = h2h_ready_states.league_id
        and league_members.user_id = auth.uid()
    )
  );

create policy h2h_ready_insert_self on h2h_ready_states
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from league_members
      where league_members.league_id = h2h_ready_states.league_id
        and league_members.user_id = auth.uid()
    )
  );

create policy h2h_ready_delete_self on h2h_ready_states
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. Auto-start trigger
-- ---------------------------------------------------------------------------
-- When the 2nd player readies, atomically pick a random first picker
-- and flip the draft from LOBBY to DRAFTING. Runs server-side so neither
-- client races the other.

create or replace function h2h_maybe_start_draft()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ready_count int;
  v_member_count int;
  v_first_pick uuid;
  v_status h2h_draft_status;
begin
  select count(*) into v_ready_count
  from h2h_ready_states
  where league_id = NEW.league_id;

  select count(*) into v_member_count
  from league_members
  where league_id = NEW.league_id;

  if v_ready_count < 2 or v_member_count < 2 then
    return NEW;
  end if;

  select status into v_status
  from h2h_drafts
  where league_id = NEW.league_id;

  if v_status is null or v_status <> 'LOBBY' then
    return NEW;
  end if;

  select user_id into v_first_pick
  from league_members
  where league_id = NEW.league_id
  order by random()
  limit 1;

  update h2h_drafts
  set status = 'DRAFTING',
      first_pick_user_id = v_first_pick,
      current_pick_number = 1,
      current_turn_started_at = now(),
      updated_at = now()
  where league_id = NEW.league_id
    and status = 'LOBBY';

  return NEW;
end;
$$;

create trigger h2h_ready_states_maybe_start
after insert on h2h_ready_states
for each row execute function h2h_maybe_start_draft();

-- ---------------------------------------------------------------------------
-- 3. Lobby expiry helper
-- ---------------------------------------------------------------------------
-- Called from the server page on render. Cancels any LOBBY draft whose
-- league has reached the T-24h cutoff. Idempotent.

create or replace function h2h_maybe_expire_lobby(
  p_league_id uuid,
  p_cutoff timestamptz
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update h2h_drafts
  set status = 'CANCELLED',
      updated_at = now()
  where league_id = p_league_id
    and status = 'LOBBY'
    and now() >= p_cutoff;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Realtime publication
-- ---------------------------------------------------------------------------

do $$
begin
  begin
    alter publication supabase_realtime add table h2h_drafts;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table h2h_draft_picks;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table h2h_ready_states;
  exception when duplicate_object then null;
  end;
end$$;

commit;
