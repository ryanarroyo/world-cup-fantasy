import type { MatchWithTeams } from "@/lib/types/database";
import { TeamBadge } from "./team-badge";

export function MatchCard({ match }: { match: MatchWithTeams }) {
  const kickoff = new Date(match.kickoff_at);
  const isLive = match.status === "LIVE";
  const isFinished = match.status === "FINISHED";

  return (
    <div
      className={`rounded-lg border bg-card p-3 ${
        isLive ? "border-live" : "border-border"
      }`}
    >
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Match {match.match_number}</span>
        {isLive && (
          <span className="flex items-center gap-1 font-medium text-live">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-live" />
            LIVE
          </span>
        )}
        {isFinished && <span className="font-medium text-primary">FT</span>}
        {!isLive && !isFinished && (
          <span>
            {kickoff.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}{" "}
            {kickoff.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <TeamBadge team={match.home_team} showRank showPot />
          <span
            className={`min-w-[1.5rem] text-center text-sm font-bold ${
              isFinished && match.winner_team_id === match.home_team_id
                ? "text-primary"
                : ""
            }`}
          >
            {match.home_score !== null ? match.home_score : "-"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <TeamBadge team={match.away_team} showRank showPot />
          <span
            className={`min-w-[1.5rem] text-center text-sm font-bold ${
              isFinished && match.winner_team_id === match.away_team_id
                ? "text-primary"
                : ""
            }`}
          >
            {match.away_score !== null ? match.away_score : "-"}
          </span>
        </div>
      </div>

      {match.home_penalties !== null && match.away_penalties !== null && (
        <div className="mt-1 text-center text-xs text-muted-foreground">
          (Pen: {match.home_penalties} - {match.away_penalties})
        </div>
      )}
    </div>
  );
}
