"use client";

import { useState, useTransition } from "react";
import type { MatchWithTeams, Prediction } from "@/lib/types/database";
import { PredictionCard } from "./prediction-card";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type PredictionInput = {
  match_id: number;
  predicted_home: number;
  predicted_away: number;
  predicted_winner_id: number | null;
};

export function PredictionForm({
  matches,
  existingPredictions,
  userId,
  round,
}: {
  matches: MatchWithTeams[];
  existingPredictions: Map<number, Prediction>;
  userId: string;
  round: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [predictions, setPredictions] = useState<Map<number, PredictionInput>>(
    () => {
      const map = new Map<number, PredictionInput>();
      for (const match of matches) {
        const existing = existingPredictions.get(match.id);
        if (existing) {
          map.set(match.id, {
            match_id: match.id,
            predicted_home: existing.predicted_home,
            predicted_away: existing.predicted_away,
            predicted_winner_id: existing.predicted_winner_id,
          });
        }
      }
      return map;
    }
  );

  const [confidences, setConfidences] = useState<Map<number, boolean>>(() => {
    const map = new Map<number, boolean>();
    for (const match of matches) {
      const existing = existingPredictions.get(match.id);
      if (existing) {
        map.set(match.id, existing.is_confident);
      }
    }
    return map;
  });

  const confidentCount = Array.from(confidences.values()).filter(Boolean).length;

  const updatePrediction = (
    matchId: number,
    field: string,
    value: number | null
  ) => {
    setPredictions((prev) => {
      const next = new Map(prev);
      const existing = next.get(matchId) ?? {
        match_id: matchId,
        predicted_home: 0,
        predicted_away: 0,
        predicted_winner_id: null,
      };
      next.set(matchId, { ...existing, [field]: value });
      return next;
    });
    setSuccess(false);
    setError(null);
  };

  const toggleConfidence = (matchId: number) => {
    setConfidences((prev) => {
      const next = new Map(prev);
      const current = next.get(matchId) ?? false;
      if (!current && confidentCount >= 3) {
        setError("Max 3 confident picks per round.");
        return prev;
      }
      next.set(matchId, !current);
      setError(null);
      return next;
    });
    setSuccess(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    const supabase = createClient();
    const now = new Date().toISOString();

    const toSave = Array.from(predictions.values()).filter((p) => {
      const match = matches.find((m) => m.id === p.match_id);
      return match && match.kickoff_at > now;
    });

    if (toSave.length === 0) {
      setError("No predictions to save (all matches may have started).");
      setSaving(false);
      return;
    }

    const { error: upsertError } = await supabase.from("predictions").upsert(
      toSave.map((p) => ({
        user_id: userId,
        match_id: p.match_id,
        predicted_home: p.predicted_home,
        predicted_away: p.predicted_away,
        predicted_winner_id: p.predicted_winner_id,
        is_confident: confidences.get(p.match_id) ?? false,
        updated_at: now,
      })),
      { onConflict: "user_id,match_id" }
    );

    if (upsertError) {
      setError(upsertError.message);
    } else {
      setSuccess(true);
      startTransition(() => router.refresh());
    }
    setSaving(false);
  };

  const predictableCount = matches.filter(
    (m) => new Date(m.kickoff_at) > new Date()
  ).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {matches.map((match) => (
          <PredictionCard
            key={match.id}
            match={match}
            prediction={predictions.get(match.id) ?? null}
            existingPrediction={existingPredictions.get(match.id) ?? null}
            isConfident={confidences.get(match.id) ?? false}
            canToggleConfident={confidentCount < 3}
            onUpdate={updatePrediction}
            onToggleConfidence={toggleConfidence}
          />
        ))}
      </div>

      {predictableCount > 0 && (
        <div className="sticky bottom-4 flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-lg">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              {predictions.size} / {matches.length} predictions
            </span>
            <span className="flex items-center gap-1 text-secondary">
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
              {confidentCount}/3 confident
            </span>
          </div>
          <div className="flex items-center gap-3">
            {error && (
              <span className="text-sm text-destructive">{error}</span>
            )}
            {success && (
              <span className="text-sm text-primary">Saved!</span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || predictions.size === 0}
              className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Predictions"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
