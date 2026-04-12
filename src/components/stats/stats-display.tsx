"use client";

import type { UserStats } from "@/lib/types/database";

const ROUND_LABELS: Record<string, string> = {
  GROUP: "Group Stage",
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarterfinals",
  SF: "Semifinals",
  "3RD": "3rd Place",
  FINAL: "Final",
};

function StatCard({
  label,
  value,
  subtitle,
  accent,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 text-3xl font-bold ${accent ? "text-primary" : "text-foreground"}`}
      >
        {value}
      </div>
      {subtitle && (
        <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>
      )}
    </div>
  );
}

export function StatsDisplay({ stats }: { stats: UserStats }) {
  const totalTendency =
    stats.tendency.home_wins + stats.tendency.away_wins + stats.tendency.draws;
  const homePct =
    totalTendency > 0
      ? Math.round((stats.tendency.home_wins / totalTendency) * 100)
      : 0;
  const awayPct =
    totalTendency > 0
      ? Math.round((stats.tendency.away_wins / totalTendency) * 100)
      : 0;
  const drawPct = totalTendency > 0 ? 100 - homePct - awayPct : 0;

  return (
    <div className="space-y-6">
      {/* Key metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Result Accuracy"
          value={`${stats.result_accuracy_pct}%`}
          subtitle={`${stats.correct_results} / ${stats.total_predictions} correct`}
          accent
        />
        <StatCard
          label="Exact Scores"
          value={`${stats.exact_accuracy_pct}%`}
          subtitle={`${stats.exact_scores} exact matches`}
        />
        <StatCard
          label="Points / Match"
          value={stats.points_per_match}
          subtitle={`${stats.total_points} total points`}
        />
        <StatCard
          label="Current Streak"
          value={
            stats.current_streak > 3
              ? `${stats.current_streak} 🔥`
              : stats.current_streak
          }
          subtitle="Consecutive correct"
          accent={stats.current_streak > 3}
        />
      </div>

      {/* Best / Worst round + Confidence */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Best Round
          </div>
          {stats.best_round ? (
            <>
              <div className="mt-1 text-lg font-bold text-primary">
                {ROUND_LABELS[stats.best_round.round] ?? stats.best_round.round}
              </div>
              <div className="text-sm text-muted-foreground">
                {stats.best_round.points} points
              </div>
            </>
          ) : (
            <div className="mt-1 text-sm text-muted-foreground">
              No data yet
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Worst Round
          </div>
          {stats.worst_round ? (
            <>
              <div className="mt-1 text-lg font-bold text-destructive">
                {ROUND_LABELS[stats.worst_round.round] ??
                  stats.worst_round.round}
              </div>
              <div className="text-sm text-muted-foreground">
                {stats.worst_round.points} points
              </div>
            </>
          ) : (
            <div className="mt-1 text-sm text-muted-foreground">
              No data yet
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Confidence Picks
          </div>
          <div className="mt-1 text-lg font-bold text-secondary">
            {stats.confident_correct} / {stats.confident_picks}
          </div>
          <div className="text-sm text-muted-foreground">
            {stats.confident_picks > 0
              ? `${Math.round((stats.confident_correct / stats.confident_picks) * 100)}% hit rate`
              : "No confident picks yet"}
          </div>
        </div>
      </div>

      {/* Tendencies */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Favorite Scoreline
          </div>
          {stats.favorite_scoreline ? (
            <>
              <div className="mt-1 text-3xl font-bold font-mono text-foreground">
                {stats.favorite_scoreline.scoreline}
              </div>
              <div className="text-sm text-muted-foreground">
                Predicted {stats.favorite_scoreline.count} times
              </div>
            </>
          ) : (
            <div className="mt-1 text-sm text-muted-foreground">
              No predictions yet
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Prediction Tendency
          </div>
          {totalTendency > 0 ? (
            <div className="space-y-2.5">
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-muted-foreground">Home wins</span>
                  <span className="font-medium">{homePct}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${homePct}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-muted-foreground">Away wins</span>
                  <span className="font-medium">{awayPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-secondary"
                    style={{ width: `${awayPct}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-muted-foreground">Draws</span>
                  <span className="font-medium">{drawPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-accent"
                    style={{ width: `${drawPct}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No predictions yet
            </div>
          )}
        </div>
      </div>

      {/* Round breakdown table */}
      {stats.round_breakdown && stats.round_breakdown.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-bold text-foreground">
              Round Breakdown
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Round</th>
                  <th className="px-3 py-2 text-center font-medium">
                    Predictions
                  </th>
                  <th className="px-3 py-2 text-center font-medium">Points</th>
                  <th className="px-3 py-2 text-center font-medium">
                    Avg/Match
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.round_breakdown.map((r) => (
                  <tr
                    key={r.round}
                    className="border-b border-border/50"
                  >
                    <td className="px-4 py-2.5 font-medium">
                      {ROUND_LABELS[r.round] ?? r.round}
                    </td>
                    <td className="px-3 py-2.5 text-center text-muted-foreground">
                      {r.predictions}
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold">
                      {r.points}
                    </td>
                    <td className="px-3 py-2.5 text-center text-muted-foreground">
                      {r.avg_points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
