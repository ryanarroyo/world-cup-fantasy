import type { Team, MatchWithTeams } from "@/lib/types/database";
import { MatchCard } from "./match-card";
import { PotDot } from "./team-badge";

type GroupStanding = {
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

function calculateStandings(
  teams: Team[],
  matches: MatchWithTeams[]
): GroupStanding[] {
  const standings = new Map<number, GroupStanding>();

  for (const team of teams) {
    standings.set(team.id, {
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    });
  }

  for (const match of matches) {
    if (match.status !== "FINISHED" || match.home_score === null || match.away_score === null) continue;

    const home = standings.get(match.home_team_id!);
    const away = standings.get(match.away_team_id!);
    if (!home || !away) continue;

    home.played++;
    away.played++;
    home.goalsFor += match.home_score;
    home.goalsAgainst += match.away_score;
    away.goalsFor += match.away_score;
    away.goalsAgainst += match.home_score;

    if (match.home_score > match.away_score) {
      home.won++;
      home.points += 3;
      away.lost++;
    } else if (match.home_score < match.away_score) {
      away.won++;
      away.points += 3;
      home.lost++;
    } else {
      home.drawn++;
      away.drawn++;
      home.points++;
      away.points++;
    }
  }

  return Array.from(standings.values())
    .map((s) => ({ ...s, goalDifference: s.goalsFor - s.goalsAgainst }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor
    );
}

export function GroupCard({
  groupLetter,
  teams,
  matches,
}: {
  groupLetter: string;
  teams: Team[];
  matches: MatchWithTeams[];
}) {
  const standings = calculateStandings(teams, matches);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-bold text-foreground">
          Group {groupLetter}
        </h3>
      </div>

      {/* Standings table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Team</th>
              <th className="px-1 py-2 text-center font-medium" title="FIFA World Ranking">Rk</th>
              <th className="px-1 py-2 text-center font-medium">P</th>
              <th className="px-1 py-2 text-center font-medium">W</th>
              <th className="px-1 py-2 text-center font-medium">D</th>
              <th className="px-1 py-2 text-center font-medium">L</th>
              <th className="px-1 py-2 text-center font-medium">GD</th>
              <th className="px-2 py-2 text-center font-medium">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <tr
                key={s.team.id}
                className={`border-b border-border/50 ${
                  i < 2
                    ? "bg-primary/5"
                    : i === 2
                      ? "bg-secondary/5"
                      : ""
                }`}
              >
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <img
                      src={s.team.flag_url}
                      alt={s.team.name}
                      className="h-3.5 w-5"
                    />
                    <span className="font-medium">{s.team.code}</span>
                    <PotDot pot={s.team.pot} />
                  </div>
                </td>
                <td className="px-1 py-1.5 text-center text-muted-foreground">
                  {s.team.fifa_rank ?? "—"}
                </td>
                <td className="px-1 py-1.5 text-center">{s.played}</td>
                <td className="px-1 py-1.5 text-center">{s.won}</td>
                <td className="px-1 py-1.5 text-center">{s.drawn}</td>
                <td className="px-1 py-1.5 text-center">{s.lost}</td>
                <td className="px-1 py-1.5 text-center">
                  {s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}
                </td>
                <td className="px-2 py-1.5 text-center font-bold">{s.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Key */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-primary/30" />
          Qualifies
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-secondary/30" />
          Possible 3rd
        </span>
        <span className="flex items-center gap-1" title="Pot 1 (highest seed)">
          <PotDot pot={1} /> P1
        </span>
        <span className="flex items-center gap-1" title="Pot 2">
          <PotDot pot={2} /> P2
        </span>
        <span className="flex items-center gap-1" title="Pot 3">
          <PotDot pot={3} /> P3
        </span>
        <span className="flex items-center gap-1" title="Pot 4">
          <PotDot pot={4} /> P4
        </span>
      </div>

      {/* Matches */}
      <div className="space-y-2 p-4 pt-2">
        <h4 className="text-xs font-medium text-muted-foreground">Matches</h4>
        <div className="grid gap-2">
          {matches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      </div>
    </div>
  );
}
