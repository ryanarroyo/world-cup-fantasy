"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function JoinLeagueForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get("code") ?? "");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setJoining(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Not authenticated");
      setJoining(false);
      return;
    }

    // Find league by invite code
    const { data: league, error: findError } = await supabase
      .from("leagues")
      .select("*, league_members(count)")
      .eq("invite_code", code.trim())
      .single();

    if (findError || !league) {
      setError("League not found. Check the invite code and try again.");
      setJoining(false);
      return;
    }

    const memberCount = (league as any).league_members?.[0]?.count ?? 0;
    if (memberCount >= league.max_members) {
      setError("This league is full.");
      setJoining(false);
      return;
    }

    // Join the league
    const { error: joinError } = await supabase
      .from("league_members")
      .insert({ league_id: league.id, user_id: user.id });

    if (joinError) {
      if (joinError.code === "23505") {
        setError("You're already a member of this league.");
      } else {
        setError(joinError.message);
      }
      setJoining(false);
      return;
    }

    window.location.href = `/leagues/${league.id}`;
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold">Join a League</h1>

      <form onSubmit={handleJoin} className="space-y-4">
        <div>
          <label
            htmlFor="code"
            className="mb-1 block text-sm font-medium text-foreground"
          >
            Invite Code
          </label>
          <input
            id="code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter invite code"
            maxLength={8}
            required
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={joining || !code.trim()}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {joining ? "Joining..." : "Join League"}
        </button>
      </form>
    </div>
  );
}

export default function JoinLeaguePage() {
  return (
    <Suspense>
      <JoinLeagueForm />
    </Suspense>
  );
}
