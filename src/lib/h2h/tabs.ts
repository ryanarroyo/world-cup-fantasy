import type { MatchWithTeams } from "@/lib/types/database";

export type TournamentTab = "scoreboard" | "rosters" | "bracket";

// Pre-kickoff (no matches FINISHED yet) → Bracket so users see the draw.
// Once any match has finished → Scoreboard so they see the standings.
export function pickDefaultTournamentTab(
  matches: MatchWithTeams[]
): TournamentTab {
  const anyFinished = matches.some((m) => m.status === "FINISHED");
  return anyFinished ? "scoreboard" : "bracket";
}
