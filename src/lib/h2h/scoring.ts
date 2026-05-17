import type { H2HDepth } from "@/lib/types/database";

export const DEPTH_LABELS: Record<H2HDepth, string> = {
  NOT_ADVANCED: "Eliminated in groups",
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarterfinals",
  SF: "Semifinals",
  FINAL: "Final",
  CHAMPION: "Champion",
};

export const DEPTH_SHORT_LABELS: Record<H2HDepth, string> = {
  NOT_ADVANCED: "Out",
  R32: "R32",
  R16: "R16",
  QF: "QF",
  SF: "SF",
  FINAL: "F",
  CHAMPION: "🏆",
};

export const CUMULATIVE_POINTS: Record<H2HDepth, number> = {
  NOT_ADVANCED: 0,
  R32: 2,
  R16: 6,
  QF: 14,
  SF: 26,
  FINAL: 42,
  CHAMPION: 62,
};

export function cumulativePointsFor(depth: H2HDepth | null): number {
  if (depth === null) return 0;
  return CUMULATIVE_POINTS[depth];
}
