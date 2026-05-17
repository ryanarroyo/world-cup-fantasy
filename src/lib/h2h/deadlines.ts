// WC26 kicks off June 11, 2026. Drafts auto-cancel 24h before kickoff
// if not already complete.
//
// Mirror of the h2h_tournament_kickoff_at() SQL function — keep in sync.

export const TOURNAMENT_KICKOFF_AT = new Date("2026-06-11T16:00:00Z");

export const DRAFT_DEADLINE_AT = new Date(
  TOURNAMENT_KICKOFF_AT.getTime() - 24 * 60 * 60 * 1000
);

export function draftDeadlinePassed(now: Date = new Date()): boolean {
  return now >= DRAFT_DEADLINE_AT;
}
