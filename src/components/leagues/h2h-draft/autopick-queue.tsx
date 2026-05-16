"use client";

import { useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { H2HAutopickQueueEntry, Team } from "@/lib/types/database";

export function H2HAutopickQueue({
  leagueId,
  userId,
  teams,
  pickedTeamIds,
  queue,
  onChange,
}: {
  leagueId: string;
  userId: string;
  teams: Team[];
  pickedTeamIds: Set<number>;
  queue: H2HAutopickQueueEntry[];
  onChange: (next: H2HAutopickQueueEntry[]) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const teamById = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams]
  );
  const queueByPriority = new Map(queue.map((q) => [q.priority, q]));

  const usedInQueue = new Set(queue.map((q) => q.team_id));

  const handleSet = async (priority: 1 | 2 | 3, teamId: number | null) => {
    const existing = queueByPriority.get(priority);
    if (teamId === null) {
      if (!existing) return;
      const { error } = await supabase
        .from("h2h_autopick_queue")
        .delete()
        .eq("league_id", leagueId)
        .eq("user_id", userId)
        .eq("priority", priority);
      if (error) return;
      onChange(queue.filter((q) => q.priority !== priority));
      return;
    }

    const next: H2HAutopickQueueEntry = {
      league_id: leagueId,
      user_id: userId,
      team_id: teamId,
      priority,
    };
    const { error } = await supabase
      .from("h2h_autopick_queue")
      .upsert(next, { onConflict: "league_id,user_id,priority" });
    if (error) return;
    const others = queue.filter((q) => q.priority !== priority);
    onChange([...others, next].sort((a, b) => a.priority - b.priority));
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-bold text-foreground">Auto-pick queue</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Picked in priority order if your timer runs out.
        </p>
      </div>
      <div className="divide-y divide-border/50">
        {[1, 2, 3].map((p) => {
          const priority = p as 1 | 2 | 3;
          const entry = queueByPriority.get(priority);
          const team = entry ? teamById.get(entry.team_id) ?? null : null;
          return (
            <QueueRow
              key={priority}
              priority={priority}
              team={team}
              teams={teams}
              pickedTeamIds={pickedTeamIds}
              usedInQueue={usedInQueue}
              onSet={(teamId) => handleSet(priority, teamId)}
            />
          );
        })}
      </div>
    </div>
  );
}

function QueueRow({
  priority,
  team,
  teams,
  pickedTeamIds,
  usedInQueue,
  onSet,
}: {
  priority: 1 | 2 | 3;
  team: Team | null;
  teams: Team[];
  pickedTeamIds: Set<number>;
  usedInQueue: Set<number>;
  onSet: (teamId: number | null) => void;
}) {
  const options = teams
    .filter((t) => !pickedTeamIds.has(t.id))
    .filter((t) => t.id === team?.id || !usedInQueue.has(t.id))
    .sort((a, b) => (a.fifa_rank ?? 9999) - (b.fifa_rank ?? 9999));

  return (
    <div className="flex items-center gap-2 px-4 py-2.5">
      <span className="w-5 text-xs font-mono text-muted-foreground">
        #{priority}
      </span>
      <select
        value={team?.id ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onSet(v === "" ? null : Number(v));
        }}
        className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none"
      >
        <option value="">— empty —</option>
        {options.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
            {t.fifa_rank ? ` (#${t.fifa_rank})` : ""}
          </option>
        ))}
      </select>
      {team && (
        <button
          type="button"
          onClick={() => onSet(null)}
          className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Clear
        </button>
      )}
    </div>
  );
}
