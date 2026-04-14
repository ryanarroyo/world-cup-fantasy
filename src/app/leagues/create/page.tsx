"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function CreateLeaguePage() {
  const router = useRouter();
  const [name, setName] = useState("");
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

    // Create the league
    const inviteCode = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    const { data: league, error: createError } = await supabase
      .from("leagues")
      .insert({ name: name.trim(), owner_id: user.id, invite_code: inviteCode })
      .select()
      .single();

    if (createError) {
      setError(createError.message);
      setSaving(false);
      return;
    }

    // Auto-join the league as a member
    const { error: joinError } = await supabase
      .from("league_members")
      .insert({ league_id: league.id, user_id: user.id });

    if (joinError) {
      setError(joinError.message);
      setSaving(false);
      return;
    }

    window.location.href = `/leagues/${league.id}`;
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold">Create a League</h1>

      <form onSubmit={handleCreate} className="space-y-4">
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
