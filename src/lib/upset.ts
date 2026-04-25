/**
 * Upset bonus rules — must mirror calculate_prediction_points() in Postgres.
 *
 * Bonus is awarded when:
 *   - Both teams have a fifa_rank
 *   - Rank gap >= 10
 *   - User picked the underdog to win OR predicted a draw that materialized
 *
 * Tier (rank gap):     +bonus (win) / +bonus (draw, half)
 *   10–19              2          / 1
 *   20–39              4          / 2
 *   40+                8          / 4
 *
 * Confidence multiplies the result by 1.5 (CEIL'd).
 * The per-round cap (top 3 upset bonuses count) is applied at user_scores aggregation.
 */

export const UPSET_RANK_GAP_MIN = 10;
export const UPSET_BONUSES_PER_ROUND_CAP = 3;

export type UpsetTier = "small" | "medium" | "huge" | null;

export function upsetTier(rankGap: number): UpsetTier {
  if (rankGap >= 40) return "huge";
  if (rankGap >= 20) return "medium";
  if (rankGap >= UPSET_RANK_GAP_MIN) return "small";
  return null;
}

export function rawWinBonus(rankGap: number): number {
  const tier = upsetTier(rankGap);
  if (tier === "huge") return 8;
  if (tier === "medium") return 4;
  if (tier === "small") return 2;
  return 0;
}

export function rawDrawBonus(rankGap: number): number {
  const tier = upsetTier(rankGap);
  if (tier === "huge") return 4;
  if (tier === "medium") return 2;
  if (tier === "small") return 1;
  return 0;
}

function applyConfidence(bonus: number, isConfident: boolean): number {
  return isConfident ? Math.ceil(bonus * 1.5) : bonus;
}

/**
 * Identify which team is the underdog (higher rank number = lower in standings).
 * Returns null if either rank is missing or ranks are equal.
 */
export function identifyUnderdog(
  homeRank: number | null,
  awayRank: number | null
): "home" | "away" | null {
  if (homeRank == null || awayRank == null) return null;
  if (homeRank === awayRank) return null;
  return homeRank > awayRank ? "home" : "away";
}

/**
 * Calculate the potential upset bonus for a hypothetical prediction.
 * Used in the UI to show "Upset pick! +N bonus" before the match.
 *
 * Returns null if no upset bonus is possible/applicable for this prediction.
 */
export function previewUpsetBonus(args: {
  homeRank: number | null;
  awayRank: number | null;
  predictedHome: number;
  predictedAway: number;
  isConfident: boolean;
}): { bonus: number; tier: UpsetTier; kind: "win" | "draw" } | null {
  const { homeRank, awayRank, predictedHome, predictedAway, isConfident } = args;
  const underdog = identifyUnderdog(homeRank, awayRank);
  if (!underdog) return null;

  const rankGap = Math.abs((homeRank ?? 0) - (awayRank ?? 0));
  const tier = upsetTier(rankGap);
  if (!tier) return null;

  // Predicting underdog to win
  const predictedHomeWin = predictedHome > predictedAway;
  const predictedAwayWin = predictedAway > predictedHome;
  const predictedDraw = predictedHome === predictedAway;

  if (
    (underdog === "home" && predictedHomeWin) ||
    (underdog === "away" && predictedAwayWin)
  ) {
    return {
      bonus: applyConfidence(rawWinBonus(rankGap), isConfident),
      tier,
      kind: "win",
    };
  }

  if (predictedDraw) {
    return {
      bonus: applyConfidence(rawDrawBonus(rankGap), isConfident),
      tier,
      kind: "draw",
    };
  }

  return null;
}
