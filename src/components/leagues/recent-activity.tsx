import type { Profile } from "@/lib/types/database";

export function RecentActivity({
  matches,
  predictions,
  members,
  currentUserId,
}: {
  matches: any[];
  predictions: any[];
  members: any[];
  currentUserId?: string;
}) {
  if (matches.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No finished matches yet. Activity will appear here as games are played.
      </div>
    );
  }

  const profileMap = new Map(
    members.map((m: any) => [m.user_id, m.profile as Profile])
  );

  // Group predictions by match
  const predsByMatch = new Map<number, any[]>();
  for (const pred of predictions) {
    const list = predsByMatch.get(pred.match_id) ?? [];
    list.push(pred);
    predsByMatch.set(pred.match_id, list);
  }

  return (
    <div className="space-y-4">
      {matches.map((match: any) => {
        const matchPreds = predsByMatch.get(match.id) ?? [];
        // Sort by points earned descending
        matchPreds.sort((a: any, b: any) => b.points_earned - a.points_earned);

        const totalPoints = matchPreds.reduce(
          (sum: number, p: any) => sum + p.points_earned,
          0
        );

        return (
          <div
            key={match.id}
            className="rounded-xl border border-border bg-card"
          >
            {/* Match header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {match.home_team && (
                    <img
                      src={match.home_team.flag_url}
                      alt=""
                      className="h-4 w-6"
                    />
                  )}
                  <span className="text-sm font-semibold">
                    {match.home_team?.code ?? "TBD"}
                  </span>
                  <span className="text-sm font-bold">
                    {match.home_score}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">-</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">
                    {match.away_score}
                  </span>
                  <span className="text-sm font-semibold">
                    {match.away_team?.code ?? "TBD"}
                  </span>
                  {match.away_team && (
                    <img
                      src={match.away_team.flag_url}
                      alt=""
                      className="h-4 w-6"
                    />
                  )}
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                Match {match.match_number}
              </span>
            </div>

            {/* Member predictions for this match */}
            <div className="divide-y divide-border/50">
              {matchPreds.length === 0 ? (
                <div className="px-4 py-3 text-xs text-muted-foreground">
                  No predictions for this match.
                </div>
              ) : (
                matchPreds.map((pred: any) => {
                  const profile = profileMap.get(pred.user_id);
                  const isCurrentUser = pred.user_id === currentUserId;
                  const gotExact =
                    pred.predicted_home === match.home_score &&
                    pred.predicted_away === match.away_score;

                  return (
                    <div
                      key={pred.id}
                      className={`flex items-center justify-between px-4 py-2 ${isCurrentUser ? "bg-primary/5" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        {profile?.avatar_url && (
                          <img
                            src={profile.avatar_url}
                            alt=""
                            className="h-5 w-5 rounded-full"
                          />
                        )}
                        <span
                          className={`text-xs ${isCurrentUser ? "font-semibold" : ""}`}
                        >
                          {profile?.display_name ?? "Unknown"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {pred.predicted_home} - {pred.predicted_away}
                        </span>
                        {gotExact && (
                          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">
                            Exact
                          </span>
                        )}
                        <span
                          className={`text-xs font-bold ${pred.points_earned > 0 ? "text-primary" : "text-destructive"}`}
                        >
                          {pred.points_earned > 0 ? "+" : ""}
                          {pred.points_earned} pts
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
