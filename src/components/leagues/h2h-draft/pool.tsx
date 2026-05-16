"use client";

import { useMemo, useState } from "react";
import type { Team } from "@/lib/types/database";

type SortKey = "fifa" | "group" | "pot" | "name";

export function H2HDraftPool({
  teams,
  pickedTeamIds,
  selectedTeamId,
  onSelectTeam,
  onPick,
  isMyTurn,
  pickPending,
}: {
  teams: Team[];
  pickedTeamIds: Set<number>;
  selectedTeamId: number | null;
  onSelectTeam: (teamId: number | null) => void;
  onPick: () => void;
  isMyTurn: boolean;
  pickPending: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("fifa");
  const [groupFilter, setGroupFilter] = useState<string>("ALL");
  const [potFilter, setPotFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    const s = new Set<string>();
    for (const t of teams) if (t.group_letter) s.add(t.group_letter);
    return Array.from(s).sort();
  }, [teams]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = teams.filter((t) => {
      if (groupFilter !== "ALL" && t.group_letter !== groupFilter) return false;
      if (potFilter !== "ALL" && String(t.pot ?? "") !== potFilter) return false;
      if (q && !t.name.toLowerCase().includes(q)) return false;
      return true;
    });
    out.sort((a, b) => {
      if (sortKey === "fifa") {
        const ar = a.fifa_rank ?? 9999;
        const br = b.fifa_rank ?? 9999;
        if (ar !== br) return ar - br;
        return a.name.localeCompare(b.name);
      }
      if (sortKey === "group") {
        const ag = a.group_letter ?? "Z";
        const bg = b.group_letter ?? "Z";
        if (ag !== bg) return ag.localeCompare(bg);
        return a.name.localeCompare(b.name);
      }
      if (sortKey === "pot") {
        const ap = a.pot ?? 99;
        const bp = b.pot ?? 99;
        if (ap !== bp) return ap - bp;
        return a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
    return out;
  }, [teams, sortKey, groupFilter, potFilter, search]);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) ?? null;
  const canPick =
    isMyTurn &&
    selectedTeam !== null &&
    !pickedTeamIds.has(selectedTeam.id) &&
    !pickPending;

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-foreground">Available teams</h3>
          <span className="text-xs text-muted-foreground">
            {filtered.filter((t) => !pickedTeamIds.has(t.id)).length} left
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="flex-1 min-w-[120px] rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <SelectControl
            value={sortKey}
            onChange={(v) => setSortKey(v as SortKey)}
            options={[
              { value: "fifa", label: "FIFA rank" },
              { value: "group", label: "Group" },
              { value: "pot", label: "Pot" },
              { value: "name", label: "Name" },
            ]}
          />
          <SelectControl
            value={groupFilter}
            onChange={setGroupFilter}
            options={[
              { value: "ALL", label: "All groups" },
              ...groups.map((g) => ({ value: g, label: `Group ${g}` })),
            ]}
          />
          <SelectControl
            value={potFilter}
            onChange={setPotFilter}
            options={[
              { value: "ALL", label: "All pots" },
              { value: "1", label: "Pot 1" },
              { value: "2", label: "Pot 2" },
              { value: "3", label: "Pot 3" },
              { value: "4", label: "Pot 4" },
            ]}
          />
        </div>
      </div>

      <div className="max-h-[420px] overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((team) => {
            const picked = pickedTeamIds.has(team.id);
            const selected = selectedTeamId === team.id;
            const disabled = picked || !isMyTurn;
            return (
              <button
                key={team.id}
                type="button"
                onClick={() => {
                  if (disabled) return;
                  onSelectTeam(selected ? null : team.id);
                }}
                disabled={disabled}
                className={`flex items-center gap-2 rounded-md border px-2 py-2 text-left text-xs transition-colors ${
                  picked
                    ? "border-border bg-muted/40 opacity-40 cursor-not-allowed"
                    : selected
                    ? "border-primary bg-primary/10"
                    : isMyTurn
                    ? "border-border bg-background hover:border-primary/50"
                    : "border-border bg-background cursor-not-allowed opacity-70"
                }`}
              >
                {team.flag_url && (
                  <img src={team.flag_url} alt="" className="h-4 w-6 rounded-sm" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground">
                    {team.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {team.group_letter && `Grp ${team.group_letter}`}
                    {team.pot && ` · Pot ${team.pot}`}
                    {team.fifa_rank && ` · #${team.fifa_rank}`}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border px-4 py-3">
        <button
          type="button"
          onClick={onPick}
          disabled={!canPick}
          className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {pickPending
            ? "Picking…"
            : selectedTeam
            ? `Pick ${selectedTeam.name}`
            : isMyTurn
            ? "Select a team"
            : "Waiting for opponent…"}
        </button>
      </div>
    </div>
  );
}

function SelectControl({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
