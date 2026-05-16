"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { LeagueMode } from "@/lib/types/database";

export default function CreateLeaguePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<LeagueMode>("PREDICTIONS");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Not authenticated");
      setSaving(false);
      return;
    }

    const inviteCode = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    const insertPayload: {
      name: string;
      owner_id: string;
      invite_code: string;
      mode: LeagueMode;
      max_members?: number;
    } = {
      name: name.trim(),
      owner_id: user.id,
      invite_code: inviteCode,
      mode,
    };
    if (mode === "H2H_DRAFT") {
      insertPayload.max_members = 2;
    }

    const { data: league, error: createError } = await supabase
      .from("leagues")
      .insert(insertPayload)
      .select()
      .single();

    if (createError) {
      setError(createError.message);
      setSaving(false);
      return;
    }

    const { error: joinError } = await supabase
      .from("league_members")
      .insert({ league_id: league.id, user_id: user.id });

    if (joinError) {
      setError(joinError.message);
      setSaving(false);
      return;
    }

    if (mode === "H2H_DRAFT") {
      const { error: draftError } = await supabase
        .from("h2h_drafts")
        .insert({ league_id: league.id, status: "LOBBY" });

      if (draftError) {
        setError(draftError.message);
        setSaving(false);
        return;
      }
    }

    window.location.href = `/leagues/${league.id}`;
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold">Create a League</h1>

      <form onSubmit={handleCreate} className="space-y-5">
        <div>
          <label
            htmlFor="name"
            className="mb-1 block text-sm font-medium text-foreground"
          >
            League Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., The World Cup Gang"
            maxLength={50}
            required
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <fieldset>
          <legend className="mb-2 block text-sm font-medium text-foreground">
            Mode
          </legend>
          <div className="space-y-2">
            <ModeOption
              value="PREDICTIONS"
              current={mode}
              onChange={setMode}
              title="Predictions"
              description="Members predict match scores. Open to any number of players."
            />
            <ModeOption
              value="H2H_DRAFT"
              current={mode}
              onChange={setMode}
              title="Head-to-Head Draft"
              description="1v1 only. Snake-draft all 48 teams, score by tournament progression."
            />
          </div>
        </fieldset>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Creating..." : "Create League"}
        </button>
      </form>
    </div>
  );
}

function ModeOption({
  value,
  current,
  onChange,
  title,
  description,
}: {
  value: LeagueMode;
  current: LeagueMode;
  onChange: (mode: LeagueMode) => void;
  title: string;
  description: string;
}) {
  const selected = current === value;
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
        selected
          ? "border-primary bg-primary/5"
          : "border-border bg-background hover:border-primary/50"
      }`}
    >
      <input
        type="radio"
        name="mode"
        value={value}
        checked={selected}
        onChange={() => onChange(value)}
        className="mt-0.5"
      />
      <div className="flex-1">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {description}
        </div>
      </div>
    </label>
  );
}
