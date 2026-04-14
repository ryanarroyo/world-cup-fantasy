"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function DeleteLeague({ leagueId }: { leagueId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    const supabase = createClient();

    // Delete members first, then the league
    await supabase.from("league_members").delete().eq("league_id", leagueId);
    const { error } = await supabase.from("leagues").delete().eq("id", leagueId);

    if (error) {
      alert(error.message);
      setDeleting(false);
      setConfirming(false);
      return;
    }

    window.location.href = "/leagues";
  };

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-sm text-destructive hover:underline"
      >
        Delete League
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Are you sure?</span>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="rounded-lg bg-destructive px-3 py-1 text-xs font-medium text-destructive-foreground disabled:opacity-50"
      >
        {deleting ? "Deleting..." : "Yes, delete"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-foreground"
      >
        Cancel
      </button>
    </div>
  );
}
