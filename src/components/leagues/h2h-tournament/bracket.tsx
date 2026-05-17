"use client";

import { useMemo } from "react";
import type { MatchWithTeams, Team } from "@/lib/types/database";

type Round = "GROUP" | "R32" | "R16" | "QF" | "SF" | "3RD" | "FINAL";

const ROUND_ORDER: Round[] = ["GROUP", "R32", "R16", "QF", "SF", "3RD", "FINAL"];
const ROUND_LABELS: Record<Round, string> = {
  GROUP: "Group Stage",
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarterfinals",
  SF: "Semifinals",
  "3RD": "3rd Place",
  FINAL: "Final",
};

export function H2HBracket({
  matches,
  ownerOfTeam,
  ownerRingColors,
}: {
  matches: MatchWithTeams[];
  ownerOfTeam: Map<number, string>;
  ownerRingColors: Map<string, string>;
}) {
  const grouped = useMemo(() => {
    const map = new Map<Round, MatchWithTeams[]>();
    for (const r of ROUND_ORDER) map.set(r, []);
    for (const m of matches) {
      const r = m.round as Round;
      if (!map.has(r)) continue;
      map.get(r)!.push(m);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.match_number - b.match_number);
    }
    return map;
  }, [matches]);

  return (
    <div className="space-y-6">
      {ROUND_ORDER.map((round) => {
        const list = grouped.get(round) ?? [];
        if (list.length === 0) return null;
        return (
          <section key={round}>
            <h3 className="mb-2 text-sm font-bold text-foreground">
              {ROUND_LABELS[round]}
            </h3>
            <div
              className={`grid gap-2 ${
                round === "FINAL" || round === "3RD"
                  ? "grid-cols-1"
                  : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              }`}
            >
              {list.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  ownerOfTeam={ownerOfTeam}
                  ownerRingColors={ownerRingColors}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function MatchCard({
  match,
  ownerOfTeam,
  ownerRingColors,
}: {
  match: MatchWithTeams;
  ownerOfTeam: Map<number, string>;
  ownerRingColors: Map<string, string>;
}) {
  const finished = match.status === "FINISHED";
  return (
    <div className="rounded-lg border border-border bg-card p-2 text-xs">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          {match.group_letter
            ? `Group ${match.group_letter}`
            : `#${match.match_number}`}
        </span>
        <span>
          {finished
            ? "Final"
            : new Date(match.kickoff_at).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
              })}
        </span>
      </div>
      <div className="mt-1.5 space-y-1">
        <TeamRow
          team={match.home_team}
          score={match.home_score}
          isWinner={
            finished &&
            match.winner_team_id !== null &&
            match.winner_team_id === match.home_team_id
          }
          owner={
            match.home_team_id !== null
              ? ownerOfTeam.get(match.home_team_id) ?? null
              : null
          }
          ownerRingColors={ownerRingColors}
        />
        <TeamRow
          team={match.away_team}
          score={match.away_score}
          isWinner={
            finished &&
            match.winner_team_id !== null &&
            match.winner_team_id === match.away_team_id
          }
          owner={
            match.away_team_id !== null
              ? ownerOfTeam.get(match.away_team_id) ?? null
              : null
          }
          ownerRingColors={ownerRingColors}
        />
      </div>
    </div>
  );
}

function TeamRow({
  team,
  score,
  isWinner,
  owner,
  ownerRingColors,
}: {
  team: Team | null;
  score: number | null;
  isWinner: boolean;
  owner: string | null;
  ownerRingColors: Map<string, string>;
}) {
  const ringClass = owner ? ownerRingColors.get(owner) ?? "" : "";
  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex h-5 w-7 items-center justify-center rounded-sm ${
          ringClass ? `ring-2 ${ringClass}` : ""
        }`}
      >
        {team?.flag_url ? (
          <img
            src={team.flag_url}
            alt=""
            className="h-4 w-6 rounded-[2px]"
          />
        ) : (
          <span className="h-3 w-5 rounded-sm bg-muted" />
        )}
      </span>
      <span
        className={`flex-1 truncate ${
          isWinner ? "font-semibold text-foreground" : "text-foreground"
        }`}
      >
        {team?.name ?? "TBD"}
      </span>
      <span className="font-mono tabular-nums text-muted-foreground">
        {score ?? "—"}
      </span>
    </div>
  );
}
