# Head-to-Head Draft Mode — Implementation Plan

A new league mode for `wc26fantasy` where two players draft the 48 World Cup teams against each other and score points based on how far their teams progress through the tournament. **Additive** to the existing predictions mode; does not replace it.

---

## 1. Overview

- **League type:** strictly 1v1 (`max_members = 2`).
- **Draft:** live synchronous snake draft of all 48 teams, 24 per player.
- **Scoring:** cumulative, progression-only, with a doubling-then-flattening curve designed to keep the scoreboard competitive through all rounds.
- **Existing predictions mode is unchanged.**

---

## 2. League creation & lifecycle

### 2.1 Creation
- Existing `/leagues/create` page gets a **Mode** toggle: *Predictions* (default, current behavior) or *Head-to-Head Draft*.
- Mode is fixed at creation; not switchable later.
- H2H leagues hard-capped at 2 members.
- A user may be in any number of H2H leagues simultaneously (no artificial cap).

### 2.2 Invite & join
- Reuse existing invite-link flow (`src/components/leagues/invite-link.tsx`). No new flow.

### 2.3 Pre-draft lobby
- Once both players are members, the league page shows a **lobby**:
  - Both players' display names and avatars.
  - Draft rules summary (curve, timer, total picks).
  - A **Ready** button per player.
  - A **presence indicator** (Supabase Realtime) showing whether the opponent is currently online.
- Draft starts the instant both players are *ready* AND both currently *online* (presence-tracked).

### 2.4 Hard deadline
- If draft has not been completed by **T-24h before tournament kickoff**:
  - League is **auto-cancelled**.
  - Player 1 sees a clear "expires at YYYY-MM-DD HH:MM" timestamp from the moment of creation.
- Once tournament kicks off, no new H2H leagues can start a draft.

### 2.5 Mutual cancel / reset
- Within the first **6 picks** of a draft, either player can request a cancel; if both confirm, the draft resets to the lobby.
- After pick 6, no in-draft cancellation.
- Before tournament kickoff (post-draft completion), the league can be reset by mutual consent.
- After tournament kickoff, the league is locked.

---

## 3. Draft mechanics

### 3.1 Order
- **Snake**: 1, 2, 2, 1, 1, 2, 2, 1, ...
- Total picks: 48 (24 per player).
- **First pick determined randomly** on draft start (server-side random; stored on `h2h_drafts.first_pick_user_id`).

### 3.2 Timer & auto-pick
- **60s per pick**, server-clock authoritative.
- Timer runs regardless of either player's connection state — no pause-on-disconnect.
- On timeout, **auto-pick** in this priority:
  1. The player's pre-set **auto-pick queue** (their top-priority remaining team).
  2. Fall back to **highest available FIFA rank** (`teams.fifa_rank ASC`).
- Auto-picks are flagged (`h2h_draft_picks.was_autopick = true`).

### 3.3 Per-player auto-pick queue
- Each player can pre-set 1–3 teams in priority order during the draft.
- Queue is private to that player.
- Used only as the timeout fallback — players who pick manually within the 60s use their manual selection.
- If a queued team is taken by the opponent, it's silently dropped from the queue.

### 3.4 Reconnection
- Draft state is the DB, not in-memory.
- Every pick is persisted immediately; Realtime is just a notification layer.
- On reconnect, client reads from `h2h_drafts` + `h2h_draft_picks` to reconstruct the room.

---

## 4. Draft-room UI

### 4.1 Always visible
1. **Pool grid** — 48 team cards, each showing flag, name, FIFA rank, group letter, pot. Picked teams greyed out.
2. **Filter/sort controls** on the pool: by FIFA rank, group, pot, name.
3. **Both rosters side-by-side**, both growing live; each slot shows team + the pick number it was selected at.
4. **Header**: current pick number, whose turn it is, time remaining.
5. **Pick history feed** — chronological "Round N, Pick M: Player X selected Team Y".

### 4.2 Visible only on your turn
6. **Pick button** — activates on a selected pool card.
7. **Queue manager** — add/remove/reorder up to 3 teams in your private auto-pick queue.

### 4.3 Notifications
- **In-app only for v1**. No push/email/SMS.
- **Tab-title flash** (`document.title = "🔔 Your pick!"`) when it becomes your turn.
- **Subtle sound + visual flash** in-room when it becomes your turn.
- **Toast/banner** when opponent joins lobby or readies up.

### 4.4 Explicitly out of scope (v1)
- No "best available" / recommended picks.
- No group-balance / roster-shape hints.
- No live trade offers.

---

## 5. Scoring system

### 5.1 Curve
**Cumulative, advancement-only** — a team earns points each round it survives, up to and including the deepest round it reaches.

| Milestone (team's deepest round) | Points awarded for that milestone | Cumulative total for a team reaching this stage |
|---|---|---|
| Advanced from group (made R32) | 2 | 2 |
| Won R32 (made R16) | 4 | 6 |
| Won R16 (made QF) | 8 | 14 |
| Won QF (made SF) | 12 | 26 |
| Won SF (made Final) | 16 | 42 |
| Won Final (champion) | 20 | 62 |

### 5.2 Group stage
- **No per-match group points.**
- Points are awarded only when a team mathematically clinches advancement (or is mathematically eliminated, in which case it earns 0).
- During group play, the league page shows a **projected scoreboard** alongside the locked scoreboard.

### 5.3 3rd-place playoff
- **No points awarded.** A SF-loser already earned their 12pt SF milestone; the 3rd-place match doesn't affect tournament depth.

### 5.4 Team withdrawal (rare)
- **Before draft starts:** team removed from the pool.
- **After draft, before kickoff:** owner gets nothing for that team; no replacement, no refund. Documented as accepted bad luck for v1.

### 5.5 Locked vs. projected
- **Locked points** = points already earned by clinched advancement.
- **Projected points** = points the team *would* earn if current group standings hold.
- Both displayed; projected updates after every match result.
- Group-stage tiebreakers follow FIFA's published order (points → goal diff → goals scored → head-to-head → etc.). Genuinely-unresolvable ties (3-way ties on all criteria) display as 50/50 in the projection.

---

## 6. Tiebreakers (final-tournament-score ties)

Cascading, in order:

1. Owns the tournament **champion**.
2. Owns the **runner-up** (final loser).
3. More teams reached **SF**.
4. More teams reached **QF**.
5. **Total goals scored** by all owned teams across the tournament.

---

## 7. In-tournament UI

### 7.1 H2H league page — three tabs

#### Scoreboard (default during tournament)
- Two columns, one per player.
- Each: current locked score, projected score, delta vs. opponent.
- **Swing indicator**: "If [team] wins their next match, score shifts by +X."

#### Rosters
- Per player, 24 teams grouped by status: **Still alive** (with current round) and **Eliminated** (with exit round + points earned).
- Sortable by points contributed.

#### Bracket
- Reuse existing `src/components/bracket/knockout-bracket.tsx` and `group-stage.tsx`.
- Color-coded borders on team flags by owner (e.g., blue = Player A, orange = Player B).
- Default tab pre-tournament and immediately post-draft.

### 7.2 Tab defaulting
- Pre-tournament / immediately post-draft: **Bracket** tab.
- During tournament: **Scoreboard** tab.

---

## 8. Edge cases

| Case | Resolution |
|---|---|
| Player 2 never joins | Auto-cancel at T-24h before kickoff. |
| Player disconnects during draft | Timer keeps running; auto-pick fires at timeout. |
| Player abandons mid-tournament | League continues on rails; abandoner loses by default. |
| Draft not finished by T-24h | League auto-cancelled. |
| Both players want to redo draft pre-kickoff | Allowed by mutual consent. |
| Either player wants to redo draft post-kickoff | Disallowed. |
| Team withdraws pre-draft | Removed from pool. |
| Team withdraws post-draft | Owner stuck; no replacement. |
| Group-stage standings genuinely tied on all FIFA criteria | Projection shows 50/50; locked score waits for resolution. |

---

## 9. Schema additions

### 9.1 Modify existing
- `leagues.mode` — new enum column `'PREDICTIONS' | 'H2H_DRAFT'`, default `'PREDICTIONS'`. Backfill existing rows to `'PREDICTIONS'`.
- Enforce `max_members = 2` when `mode = 'H2H_DRAFT'` (check constraint or trigger).

### 9.2 New tables

**`h2h_drafts`** (one row per H2H league)
- `league_id` PK / FK → `leagues.id`
- `status` enum: `'LOBBY' | 'READY' | 'DRAFTING' | 'COMPLETE' | 'CANCELLED'`
- `first_pick_user_id` FK → `profiles.id`
- `current_pick_number` int, 0–48
- `current_turn_started_at` timestamptz (server-authoritative timer)
- `created_at`, `updated_at`

**`h2h_draft_picks`** (one row per pick made)
- `id` PK
- `league_id` FK
- `pick_number` int, 1–48
- `user_id` FK
- `team_id` FK
- `was_autopick` bool
- `picked_at` timestamptz
- Unique: `(league_id, pick_number)`, `(league_id, team_id)`

**`h2h_autopick_queue`** (per-player private queue)
- `league_id`, `user_id`, `team_id`, `priority` (1–3)
- Unique: `(league_id, user_id, priority)`, `(league_id, user_id, team_id)`

**`h2h_scores`** (league-scoped scoreboard cache)
- `league_id`, `user_id` (composite PK)
- `locked_points` int
- `projected_points` int
- `teams_alive` int
- `teams_eliminated` int
- `champion_owned` bool
- `runner_up_owned` bool
- `sf_teams_count` int
- `qf_teams_count` int
- `total_goals` int
- `updated_at` timestamptz

### 9.3 New DB function
**`compute_h2h_score(league_id uuid)`**
- Walks the 24 teams owned by each user via `h2h_draft_picks`.
- For each team, determines deepest round reached from `matches` table.
- Sums cumulative curve points (2 / 4 / 8 / 12 / 16 / 20).
- Computes projected score using FIFA group-stage tiebreaker rules where group play is incomplete.
- Writes both rows of `h2h_scores`.
- Returns void.

### 9.4 Trigger
- AFTER UPDATE on `matches` WHEN `status` becomes `'FINISHED'` OR `winner_team_id` IS NOT NULL: call `compute_h2h_score()` for every H2H league.
- (Optionally throttle if performance becomes a concern; unlikely with the volume here.)

### 9.5 TypeScript types
Add to `src/lib/types/database.ts`:
- `LeagueMode = 'PREDICTIONS' | 'H2H_DRAFT'`
- `H2HDraft`, `H2HDraftPick`, `H2HAutopickQueueEntry`, `H2HScore`
- Extend existing `League` type with `mode`.

---

## 10. Implementation sequencing

A suggested order of work, smallest unit of value first.

### Phase 1 — Schema & types
1. Migration: add `leagues.mode`, backfill, add check constraint.
2. Migration: create `h2h_drafts`, `h2h_draft_picks`, `h2h_autopick_queue`, `h2h_scores`.
3. TypeScript types in `src/lib/types/database.ts`.
4. RLS policies (read-own-league, write-own-pick-only-on-your-turn, etc.).

### Phase 2 — League creation
1. Add **Mode** toggle to `/leagues/create`.
2. Update league detail page (`/leagues/[id]/page.tsx`) to branch on `mode`.
3. H2H-mode landing: lobby UI.

### Phase 3 — Pre-draft lobby
1. Two-player join detection + Ready button.
2. Realtime presence indicator (use existing `realtime-provider.tsx`).
3. Auto-cancel at T-24h logic (a scheduled function or check-on-page-load).
4. Draft initialization: write `h2h_drafts` row, random `first_pick_user_id`, set status `'DRAFTING'`.

### Phase 4 — Live draft room
1. Pool grid component with filter/sort.
2. Both-rosters component.
3. Pick history feed.
4. Server-authoritative turn handling + 60s timer.
5. Realtime broadcast of picks.
6. Auto-pick logic (queue first, FIFA fallback).
7. Auto-pick queue UI (per player, private).
8. Tab-title flash + sound on turn.
9. Mutual-cancel-within-6-picks affordance.

### Phase 5 — Scoring
1. `compute_h2h_score()` function.
2. Trigger on `matches` updates.
3. Projection logic (FIFA group tiebreaker SQL).
4. Tiebreaker cascade.

### Phase 6 — In-tournament UI
1. Scoreboard tab.
2. Rosters tab.
3. Color-coded bracket overlay on existing bracket components.
4. Tab defaulting (context-dependent).
5. Swing indicator on scoreboard.

### Phase 7 — Polish
1. Empty/error states.
2. Mobile layout pass on draft room (48-team grid is dense).
3. Telemetry / event logs if useful.

---

## 11. Open items / future work (explicitly out of scope for v1)

- Push / email / SMS notifications.
- Async drafts.
- 3+ player leagues.
- Auction-style drafting.
- Trades during the tournament.
- Replacement-team logic for withdrawals.
- Best-available pick suggestions.
- Public / cross-league leaderboards in H2H mode.
