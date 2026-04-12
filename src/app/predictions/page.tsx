import { createClient } from "@/lib/supabase/server";
import type { Team, MatchWithTeams, Prediction } from "@/lib/types/database";
import { PredictionForm } from "@/components/predictions/prediction-form";
import { RoundFilter } from "@/components/predictions/round-filter";

export default async function PredictionsPage({
  searchParams,
}: {
  searchParams: Promise<{ round?: string }>;
}) {
  const params = await searchParams;
  const round = params.round ?? "GROUP";
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [matchesResult, predictionsResult] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*), winner_team:teams!matches_winner_team_id_fkey(*)"
      )
      .eq("round", round)
      .order("match_number"),
    user
      ? supabase.from("predictions").select("*").eq("user_id", user.id)
      : Promise.resolve({ data: [] }),
  ]);

  const matches = (matchesResult.data ?? []) as MatchWithTeams[];
  const predictions = (predictionsResult.data ?? []) as Prediction[];

  const predictionMap = new Map(predictions.map((p) => [p.match_id, p]));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Predictions</h1>
          <p className="text-sm text-muted-foreground">
            Predict the exact score for each match. Predictions lock at kickoff.
          </p>
        </div>
        <RoundFilter currentRound={round} />
      </div>

      {matches.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          No matches found for this round.
        </div>
      ) : (
        <PredictionForm
          matches={matches}
          existingPredictions={predictionMap}
          userId={user?.id ?? ""}
          round={round}
        />
      )}
    </div>
  );
}
