# Add 1v1 Head-to-Head draft mode

Adds a new league mode where two players snake-draft all 48 World Cup teams (24 each) and score by tournament progression. **Additive only** — the existing predictions flow is untouched.

## What changes from the user's POV

- `/leagues/create` gets a Mode toggle: *Predictions* (default, current behavior) or *Head-to-Head Draft*.
- H2H leagues are hard-capped at 2 players, invited via the existing invite-link flow.
- Once both players join and click Ready, a live snake draft kicks off with a 60s per-pick timer and Supabase Realtime presence.
- After all 48 picks, the league page switches to a Scoreboard / Rosters / Bracket tabbed view that updates as matches finish.

## Scoring

Cumulative, advancement-only — curve B. A team contributes:

| Reached round | Cumulative |
|---|---|
| Advanced from group (R32) | 2 |
| Won R32 (R16) | 6 |
| Won R16 (QF) | 14 |
| Won QF (SF) | 26 |
| Won SF (Final) | 42 |
| Won Final (champion) | 62 |

Designed so the late rounds dominate enough to keep the matchup competitive — a player ahead after group stage can still be flipped by a finalist or champion. Tiebreakers cascade: champion ownership → runner-up ownership → SF teams → QF teams → total goals.

Locked points = clinched. Projected points = "if current group standings hold." Both shown in the scoreboard.

## Schema (`supabase/migrations/202605160000{01..07}_*.sql`)

- `leagues.mode` enum (`PREDICTIONS` / `H2H_DRAFT`) with a check constraint enforcing `max_members = 2` for H2H.
- `h2h_drafts` — per-league draft state with server-authoritative turn timer.
- `h2h_draft_picks` — one row per pick, unique on `(league_id, pick_number)` and `(league_id, team_id)`.
- `h2h_autopick_queue` — per-player private queue (max 3 entries).
- `h2h_scores` — league-scoped scoreboard cache with locked/projected points and tiebreaker columns.
- `h2h_ready_states` — lobby ready-up signaling.
- `SECURITY DEFINER` RPCs: `h2h_make_pick`, `h2h_autopick_if_expired`, `h2h_cancel_draft`, `h2h_maybe_expire_lobby`, `h2h_team_statuses`, `compute_h2h_score`.
- Triggers: auto-start draft when both ready, recompute scores on match changes, initialize scoreboard rows on each pick.
- All H2H tables + `h2h_scores` added to the `supabase_realtime` publication.

RLS: writes on draft state / picks / scores happen only through the RPCs. Autopick queue gets owner-only CRUD. Member-only SELECT on everything else.

## Frontend

- `src/lib/h2h/` — pure helpers (snake order math, scoring labels, deadlines).
- `src/components/leagues/h2h-league-view.tsx` — top branching shell (lobby vs draft room vs tournament view).
- `src/components/leagues/h2h-lobby.tsx` — realtime presence + Ready button.
- `src/components/leagues/h2h-draft-room.tsx` + `h2h-draft/{pool,autopick-queue}.tsx` — live draft room with 60s timer, server-authoritative picks, tab-title flash, synthesized beep, mutual-cancel within first 6 picks.
- `src/components/leagues/h2h-tournament-view.tsx` + `h2h-tournament/{scoreboard,rosters,bracket}.tsx` — three-tab post-draft view with owner-colored bracket overlay (custom, doesn't touch shared `/bracket` components).

## Design doc

Full design context and decisions in `H2H_DRAFT_PLAN.md` (committed alongside the schema in phase 1).

## Out of scope (v1)

Explicitly deferred: push/email/SMS notifications, async drafts, 3+ player leagues, auction-style drafts, in-tournament trades, withdrawn-team replacement logic, deeper FIFA group tiebreakers (head-to-head, fair play, draw — cut-line ties fall back to `team_id`).

## Security follow-ups already applied

After the initial 7-phase build, two follow-up commits address review findings:

- `cffa99c` — drops client-supplied cutoff from `h2h_maybe_expire_lobby` (was a force-cancel vector), handles penalty-shootout final winners, fires `h2h_autopick_if_expired` on page load so a stalled draft self-heals on the next visit.
- `aef0551` — adds membership check to `h2h_autopick_if_expired`, removes a duplicate `router.refresh()` listener in the tournament view.

## Test plan

No automated tests (project has no test framework). Manual end-to-end verification:

- [ ] Create an H2H league as user A; verify mode pill on leagues list.
- [ ] Join as user B from a second browser; both see the lobby with presence dots.
- [ ] Both click Ready → draft starts with random first picker; player-1 sees `isMyTurn`, timer counts down.
- [ ] Make manual picks; verify roster + pick history + opponent's grid update live on both sides.
- [ ] Let a turn time out → auto-pick fires within ~3s; flagged `auto` in the roster.
- [ ] Pre-set the auto-pick queue → timeout uses the queue before FIFA fallback.
- [ ] Within first 6 picks, request cancel from A; B sees the prompt; B confirms → status flips to CANCELLED.
- [ ] Complete a real draft (or 48 picks); status flips to COMPLETE, page renders the tournament view with the "Draft locked in" banner.
- [ ] Manually update a match: `update matches set status='FINISHED', winner_team_id=… where round='GROUP' and …;` → scoreboard updates within seconds via realtime; projected points adjust.
- [ ] Mark all group matches finished → locked points advance; ineligible teams move to the Eliminated section.
- [ ] Set the final match FINISHED with `winner_team_id` → champion gets +62, `champion_owned` flips.
- [ ] Set the final FINISHED with NULL `winner_team_id` but `home_penalties/away_penalties` set → champion is resolved correctly.
- [ ] Confirm an empty filter state in the pool grid, the H2H pill + draft status pill on `/leagues`, and the autopick error console log if you cause the RPC to fail.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
