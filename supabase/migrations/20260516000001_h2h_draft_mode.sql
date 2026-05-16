-- H2H Draft Mode — Phase 1: schema, types, RLS.
-- See H2H_DRAFT_PLAN.md for design context.

begin;

-- ---------------------------------------------------------------------------
-- 1. League mode
-- ---------------------------------------------------------------------------

create type league_mode as enum ('PREDICTIONS', 'H2H_DRAFT');

alter table leagues
  add column mode league_mode not null default 'PREDICTIONS';

-- H2H leagues are strictly 1v1. Enforce at the leagues row level; pair this
-- with whatever app-side / trigger logic already caps league_members.
alter table leagues
  add constraint leagues_h2h_max_two_chk
  check (mode <> 'H2H_DRAFT' or max_members = 2);

-- ---------------------------------------------------------------------------
-- 2. Draft state
-- ---------------------------------------------------------------------------

create type h2h_draft_status as enum (
  'LOBBY',      -- waiting for second player / ready-ups
  'READY',      -- both readied, draft about to start
  'DRAFTING',   -- picks in progress
  'COMPLETE',   -- all 48 picks made
  'CANCELLED'   -- aborted (mutual cancel or auto-cancel at T-24h)
);

create table h2h_drafts (
  league_id uuid primary key references leagues(id) on delete cascade,
  status h2h_draft_status not null default 'LOBBY',
  first_pick_user_id uuid references profiles(id),
  current_pick_number int not null default 0
    check (current_pick_number between 0 and 48),
  current_turn_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Draft picks
-- ---------------------------------------------------------------------------

create table h2h_draft_picks (
  id bigserial primary key,
  league_id uuid not null references leagues(id) on delete cascade,
  pick_number int not null check (pick_number between 1 and 48),
  user_id uuid not null references profiles(id),
  team_id int not null references teams(id),
  was_autopick boolean not null default false,
  picked_at timestamptz not null default now(),
  unique (league_id, pick_number),
  unique (league_id, team_id)
);

create index h2h_draft_picks_league_user_idx
  on h2h_draft_picks (league_id, user_id);

-- ---------------------------------------------------------------------------
-- 4. Per-player private auto-pick queue
-- ---------------------------------------------------------------------------

create table h2h_autopick_queue (
  league_id uuid not null references leagues(id) on delete cascade,
  user_id uuid not null references profiles(id),
  team_id int not null references teams(id),
  priority int not null check (priority between 1 and 3),
  primary key (league_id, user_id, priority),
  unique (league_id, user_id, team_id)
);

-- ---------------------------------------------------------------------------
-- 5. Per-league scoreboard cache
-- ---------------------------------------------------------------------------

create table h2h_scores (
  league_id uuid not null references leagues(id) on delete cascade,
  user_id uuid not null references profiles(id),
  locked_points int not null default 0,
  projected_points int not null default 0,
  teams_alive int not null default 0,
  teams_eliminated int not null default 0,
  champion_owned boolean not null default false,
  runner_up_owned boolean not null default false,
  sf_teams_count int not null default 0,
  qf_teams_count int not null default 0,
  total_goals int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------
-- Strategy: league members can read draft state / picks / scores. All writes
-- on those tables happen via SECURITY DEFINER functions (added in Phase 4/5),
-- so we omit write policies here — under RLS, missing policy = denied for
-- non-service roles. The auto-pick queue is the one exception: it's the
-- player's private list, owner has full CRUD.

alter table h2h_drafts enable row level security;
alter table h2h_draft_picks enable row level security;
alter table h2h_autopick_queue enable row level security;
alter table h2h_scores enable row level security;

create policy h2h_drafts_select_member on h2h_drafts
  for select using (
    exists (
      select 1 from league_members
      where league_members.league_id = h2h_drafts.league_id
        and league_members.user_id = auth.uid()
    )
  );

create policy h2h_draft_picks_select_member on h2h_draft_picks
  for select using (
    exists (
      select 1 from league_members
      where league_members.league_id = h2h_draft_picks.league_id
        and league_members.user_id = auth.uid()
    )
  );

create policy h2h_scores_select_member on h2h_scores
  for select using (
    exists (
      select 1 from league_members
      where league_members.league_id = h2h_scores.league_id
        and league_members.user_id = auth.uid()
    )
  );

-- Auto-pick queue: owner-only, and must be a member of the league.
create policy h2h_autopick_queue_all_owner on h2h_autopick_queue
  for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from league_members
      where league_members.league_id = h2h_autopick_queue.league_id
        and league_members.user_id = auth.uid()
    )
  );

commit;
