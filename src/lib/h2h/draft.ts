export const PICK_TIMER_SECONDS = 60;
export const PICK_TIMER_MS = PICK_TIMER_SECONDS * 1000;
export const TOTAL_PICKS = 48;
export const PICKS_PER_PLAYER = 24;
export const MUTUAL_CANCEL_PICK_LIMIT = 6;

// Snake order: P1 P2 / P2 P1 / P1 P2 / P2 P1 ...
// For pick number n (1-indexed): floor(n/2) % 2 === 0 → first picker.
export function isFirstPickerTurn(pickNumber: number): boolean {
  return Math.floor(pickNumber / 2) % 2 === 0;
}

export function expectedUserIdForPick(
  pickNumber: number,
  firstPickerId: string,
  secondPickerId: string
): string {
  return isFirstPickerTurn(pickNumber) ? firstPickerId : secondPickerId;
}

export function pickRoundAndPosition(pickNumber: number): {
  round: number;
  posInRound: 1 | 2;
} {
  const round = Math.ceil(pickNumber / 2);
  const posInRound = (((pickNumber - 1) % 2) + 1) as 1 | 2;
  return { round, posInRound };
}

export function secondsRemainingForTurn(
  currentTurnStartedAt: string | null,
  now: Date = new Date()
): number {
  if (!currentTurnStartedAt) return 0;
  const elapsedMs = now.getTime() - new Date(currentTurnStartedAt).getTime();
  return Math.max(0, Math.ceil((PICK_TIMER_MS - elapsedMs) / 1000));
}
