"use client";

import { useState } from "react";
import type { Profile } from "@/lib/types/database";

const ROUND_OPTIONS = [
  { value: "all", label: "All" },
  { value: "GROUP", label: "Group" },
  { value: "R32", label: "R32" },
  { value: "R16", label: "R16" },
  { value: "QF", label: "QF" },
  { value: "SF", label: "SF" },
  { value: "3RD", label: "3rd" },
  { value: "FINAL", label: "Final" },
];

export function MatchPredictions({
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
  const [roundFilter, setRoundFilter] = useState("all");

  if (matches.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No finished matches yet. Predictions will appear here after matches are
        played.
      </div>
    );
  }

  const profileMap = new Map(
    members.map((m: any) => [m.user_id, m.profile as Profile])
  );

  const predsByMatch = new Map<number, any[]>();
  for (const pred of predictions) {
    const list = predsByMatch.get(pred.match_id) ?? [];
    list.push(pred);
    predsByMatch.set(pred.match_id, list);
  }

  const filteredMatches =
    roundFilter === "all"
      ? matches
      : matches.filter((m: any) => m.round === roundFilter);

  return (
    <div className="space-y-4">
      {/* Round filter */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
        {ROUND_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setRoundFilter(opt.value)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              roundFilter === opt.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {filteredMatches.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No finished matches for this round yet.
        </div>
      ) : (
        filteredMatches.map((match: any) => {
          const matchPreds = predsByMatch.get(match.id) ?? [];

          return (
            <div
              key={match.id}
              className="rounded-xl border border-border bg-card"
            >
              {/* Match result */}
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
                <div className="text-right">
                  <span className="text-xs text-muted-foreground">
                    Match {match.match_number}
                  </span>
                  {match.group_letter && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      (Group {match.group_letter})
                    </span>
                  )}
                </div>
              </div>

              {/* All members' predictions */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50 text-muted-foreground">
                      <th className="px-4 py-2 text-left font-medium">
                        Player
                      </th>
                      <th className="px-2 py-2 text-center font-medium">
                        Prediction
                      </th>
                      <th className="px-2 py-2 text-center font-medium">
                        Result
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Points
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member: any) => {
                      const profile = profileMap.get(member.user_id);
                      const pred = matchPreds.find(
                        (p: any) => p.user_id === member.user_id
                      );
                      const isCurrentUser = member.user_id === currentUserId;
                      const gotExact =
                        pred &&
                        pred.predicted_home === match.home_score &&
                        pred.predicted_away === match.away_score;
                      const gotResult =
                        pred && pred.points_earned > 0 && !gotExact;

                      return (
                        <tr
                          key={member.id}
                          className={`border-b border-border/30 ${isCurrentUser ? "bg-primary/5" : ""}`}
                        >
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              {profile?.avatar_url && (
                                <img
                                  src={profile.avatar_url}
                                  alt=""
                                  className="h-4 w-4 rounded-full"
                                />
                              )}
                              <span
                                className={
                                  isCurrentUser ? "font-semibold" : ""
                                }
                              >
                                {profile?.display_name ?? "Unknown"}
                              </span>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center">
                            {pred ? (
                              <span className="font-mono">
                                {pred.predicted_home} - {pred.predicted_away}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-center">
                            {gotExact ? (
                              <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">
                                Exact
                              </span>
                            ) : gotResult ? (
                              <span className="rounded-full bg-secondary/20 px-2 py-0.5 text-[10px] font-medium text-secondary">
                                Correct
                              </span>
                            ) : pred ? (
                              <span className="rounded-full bg-destructive/20 px-2 py-0.5 text-[10px] font-medium text-destructive">
                                Wrong
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-bold">
                            {pred ? (
                              <span
                                className={
                                  pred.points_earned > 0
                                    ? "text-primary"
                                    : "text-muted-foreground"
                                }
                              >
                                {pred.points_earned > 0 ? "+" : ""}
                                {pred.points_earned}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
