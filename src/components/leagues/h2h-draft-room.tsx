"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { H2HDraftPool } from "@/components/leagues/h2h-draft/pool";
import { H2HAutopickQueue } from "@/components/leagues/h2h-draft/autopick-queue";
import {
  MUTUAL_CANCEL_PICK_LIMIT,
  PICKS_PER_PLAYER,
  PICK_TIMER_SECONDS,
  TOTAL_PICKS,
  expectedUserIdForPick,
  pickRoundAndPosition,
  secondsRemainingForTurn,
} from "@/lib/h2h/draft";
import type {
  H2HAutopickQueueEntry,
  H2HDraft,
  H2HDraftPick,
  LeagueMember,
  Profile,
  Team,
} from "@/lib/types/database";

type MemberWithProfile = LeagueMember & { profile: Profile | null };

export function H2HDraftRoom({
  leagueId,
  initialDraft,
  members,
  teams,
  initialPicks,
  initialQueue,
  currentUserId,
}: {
  leagueId: string;
  initialDraft: H2HDraft;
  members: MemberWithProfile[];
  teams: Team[];
  initialPicks: H2HDraftPick[];
  initialQueue: H2HAutopickQueueEntry[];
  currentUserId: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [draft, setDraft] = useState<H2HDraft>(initialDraft);
  const [picks, setPicks] = useState<H2HDraftPick[]>(initialPicks);
  const [queue, setQueue] = useState<H2HAutopickQueueEntry[]>(initialQueue);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [pickPending, setPickPending] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [cancelPending, setCancelPending] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const firstPickerId = draft.first_pick_user_id;
  const secondPickerId =
    members.find((m) => m.user_id !== firstPickerId)?.user_id ?? null;

  const onClockUserId = useMemo(() => {
    if (!firstPickerId || !secondPickerId) return null;
    if (draft.status !== "DRAFTING") return null;
    return expectedUserIdForPick(
      draft.current_pick_number,
      firstPickerId,
      secondPickerId
    );
  }, [draft.status, draft.current_pick_number, firstPickerId, secondPickerId]);

  const isMyTurn = onClockUserId === currentUserId;

  const teamById = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams]
  );
  const pickedTeamIds = useMemo(
    () => new Set(picks.map((p) => p.team_id)),
    [picks]
  );
  const picksByUser = useMemo(() => {
    const map = new Map<string, H2HDraftPick[]>();
    for (const m of members) map.set(m.user_id, []);
    for (const p of picks) {
      if (!map.has(p.user_id)) map.set(p.user_id, []);
      map.get(p.user_id)!.push(p);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.pick_number - b.pick_number);
    }
    return map;
  }, [picks, members]);

  // ---- Realtime subscriptions ----------------------------------------------
  useEffect(() => {
    const channel = supabase
      .channel(`h2h-draft:${leagueId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "h2h_drafts",
          filter: `league_id=eq.${leagueId}`,
        },
        (payload) => {
          setDraft(payload.new as H2HDraft);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "h2h_draft_picks",
          filter: `league_id=eq.${leagueId}`,
        },
        (payload) => {
          const pick = payload.new as H2HDraftPick;
          setPicks((prev) => {
            if (prev.some((p) => p.id === pick.id)) return prev;
            return [...prev, pick].sort(
              (a, b) => a.pick_number - b.pick_number
            );
          });
          setSelectedTeamId((curr) => (curr === pick.team_id ? null : curr));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, leagueId]);

  // ---- 1-second ticker for the timer ----------------------------------------
  useEffect(() => {
    if (draft.status !== "DRAFTING") return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [draft.status]);

  const secondsRemaining = secondsRemainingForTurn(
    draft.current_turn_started_at,
    new Date(nowTick)
  );

  // ---- Auto-pick fire-off ---------------------------------------------------
  const lastAutopickPickRef = useRef<number | null>(null);
  useEffect(() => {
    if (draft.status !== "DRAFTING") return;
    if (secondsRemaining > 0) return;
    if (lastAutopickPickRef.current === draft.current_pick_number) return;

    // On-clock player calls immediately; off-clock waits ~2s as a fallback.
    const delay = isMyTurn ? 200 : 2000;
    const handle = setTimeout(async () => {
      lastAutopickPickRef.current = draft.current_pick_number;
      await supabase.rpc("h2h_autopick_if_expired", {
        p_league_id: leagueId,
      });
    }, delay);
    return () => clearTimeout(handle);
  }, [
    supabase,
    leagueId,
    draft.status,
    draft.current_pick_number,
    secondsRemaining,
    isMyTurn,
  ]);

  // ---- Tab title flash on your turn -----------------------------------------
  useEffect(() => {
    if (typeof document === "undefined") return;
    const original = document.title;
    if (draft.status === "DRAFTING" && isMyTurn) {
      let on = true;
      const interval = setInterval(() => {
        document.title = on ? "🔔 Your pick!" : original;
        on = !on;
      }, 800);
      return () => {
        clearInterval(interval);
        document.title = original;
      };
    }
    return () => {
      document.title = original;
    };
  }, [draft.status, isMyTurn]);

  // ---- Beep on turn transition to mine --------------------------------------
  const wasMyTurnRef = useRef(isMyTurn);
  useEffect(() => {
    if (draft.status !== "DRAFTING") {
      wasMyTurnRef.current = isMyTurn;
      return;
    }
    if (isMyTurn && !wasMyTurnRef.current) {
      playBeep();
    }
    wasMyTurnRef.current = isMyTurn;
  }, [isMyTurn, draft.status]);

  // ---- Actions --------------------------------------------------------------
  const handlePick = useCallback(async () => {
    if (!selectedTeamId || !isMyTurn || pickPending) return;
    setPickPending(true);
    setPickError(null);
    const { error } = await supabase.rpc("h2h_make_pick", {
      p_league_id: leagueId,
      p_team_id: selectedTeamId,
    });
    if (error) {
      setPickError(error.message);
    } else {
      setSelectedTeamId(null);
    }
    setPickPending(false);
  }, [supabase, leagueId, selectedTeamId, isMyTurn, pickPending]);

  const handleCancel = useCallback(async () => {
    setCancelPending(true);
    setPickError(null);
    const { error } = await supabase.rpc("h2h_cancel_draft", {
      p_league_id: leagueId,
    });
    if (error) setPickError(error.message);
    setCancelPending(false);
  }, [supabase, leagueId]);

  // ---- Render ---------------------------------------------------------------
  if (draft.status === "CANCELLED") {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="text-sm font-medium text-destructive">Draft cancelled.</p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="mt-3 text-xs text-muted-foreground underline"
        >
          Refresh
        </button>
      </div>
    );
  }

  const draftComplete = draft.status === "COMPLETE";
  const { round, posInRound } = pickRoundAndPosition(
    Math.min(draft.current_pick_number, TOTAL_PICKS)
  );
  const cancelEligible =
    !draftComplete &&
    draft.status === "DRAFTING" &&
    draft.current_pick_number <= MUTUAL_CANCEL_PICK_LIMIT;
  const cancelLabel = (() => {
    if (draft.cancel_requested_by === null) return "Request cancel";
    if (draft.cancel_requested_by === currentUserId) return "Withdraw request";
    return "Confirm cancel";
  })();

  return (
    <div className="space-y-4">
      <TurnHeader
        draftComplete={draftComplete}
        currentPickNumber={draft.current_pick_number}
        round={round}
        posInRound={posInRound}
        secondsRemaining={secondsRemaining}
        onClockUser={
          onClockUserId
            ? members.find((m) => m.user_id === onClockUserId) ?? null
            : null
        }
        isMyTurn={isMyTurn}
      />

      {pickError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {pickError}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {!draftComplete && (
            <H2HDraftPool
              teams={teams}
              pickedTeamIds={pickedTeamIds}
              selectedTeamId={selectedTeamId}
              onSelectTeam={setSelectedTeamId}
              onPick={handlePick}
              isMyTurn={isMyTurn}
              pickPending={pickPending}
            />
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {members.map((m) => {
              const userPicks = picksByUser.get(m.user_id) ?? [];
              const isCurrent = m.user_id === currentUserId;
              const isOnClock = m.user_id === onClockUserId;
              return (
                <RosterCard
                  key={m.id}
                  member={m}
                  picks={userPicks}
                  teamById={teamById}
                  isCurrent={isCurrent}
                  isOnClock={isOnClock}
                />
              );
            })}
          </div>

          <PickHistory picks={picks} members={members} teamById={teamById} />
        </div>

        <div className="space-y-4">
          {!draftComplete && (
            <H2HAutopickQueue
              leagueId={leagueId}
              userId={currentUserId}
              teams={teams}
              pickedTeamIds={pickedTeamIds}
              queue={queue}
              onChange={setQueue}
            />
          )}

          {cancelEligible && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-bold text-foreground">
                Cancel draft
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Allowed within the first {MUTUAL_CANCEL_PICK_LIMIT} picks.
                Requires both players.
              </p>
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelPending}
                className="mt-3 w-full rounded-lg border border-destructive/40 px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              {draft.cancel_requested_by &&
                draft.cancel_requested_by !== currentUserId && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Your opponent has requested cancellation.
                  </p>
                )}
              {draft.cancel_requested_by === currentUserId && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Waiting for your opponent to confirm.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TurnHeader({
  draftComplete,
  currentPickNumber,
  round,
  posInRound,
  secondsRemaining,
  onClockUser,
  isMyTurn,
}: {
  draftComplete: boolean;
  currentPickNumber: number;
  round: number;
  posInRound: 1 | 2;
  secondsRemaining: number;
  onClockUser: MemberWithProfile | null;
  isMyTurn: boolean;
}) {
  if (draftComplete) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
        <p className="text-sm font-medium text-foreground">Draft complete</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          All {TOTAL_PICKS} picks made. Tournament scoring begins at kickoff.
        </p>
      </div>
    );
  }
  const lowTime = secondsRemaining <= 10;
  return (
    <div
      className={`rounded-xl border px-4 py-3 transition-colors ${
        isMyTurn
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card"
      } ${lowTime && isMyTurn ? "animate-pulse" : ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">
            Pick {currentPickNumber} of {TOTAL_PICKS} · Round {round}/
            {PICKS_PER_PLAYER}
          </div>
          <div className="mt-0.5 truncate text-sm font-medium text-foreground">
            {isMyTurn
              ? "Your pick"
              : onClockUser
              ? `${onClockUser.profile?.display_name ?? "Opponent"} is picking…`
              : "Waiting…"}
          </div>
        </div>
        <div
          className={`tabular-nums text-xl font-bold ${
            lowTime ? "text-destructive" : "text-foreground"
          }`}
        >
          {secondsRemaining}s
        </div>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-all ${
            lowTime ? "bg-destructive" : "bg-primary"
          }`}
          style={{
            width: `${(secondsRemaining / PICK_TIMER_SECONDS) * 100}%`,
          }}
        />
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">
        Position {posInRound} of 2 this round
      </div>
    </div>
  );
}

function RosterCard({
  member,
  picks,
  teamById,
  isCurrent,
  isOnClock,
}: {
  member: MemberWithProfile;
  picks: H2HDraftPick[];
  teamById: Map<number, Team>;
  isCurrent: boolean;
  isOnClock: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-card ${
        isOnClock ? "border-primary/40" : "border-border"
      }`}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        {member.profile?.avatar_url && (
          <img
            src={member.profile.avatar_url}
            alt=""
            className="h-5 w-5 rounded-full"
          />
        )}
        <span
          className={`text-sm ${isCurrent ? "font-semibold" : "font-medium"}`}
        >
          {member.profile?.display_name ?? "Unknown"}
          {isCurrent && (
            <span className="ml-1.5 text-xs text-primary">(you)</span>
          )}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {picks.length} / {PICKS_PER_PLAYER}
        </span>
      </div>
      <div className="max-h-[260px] overflow-y-auto px-2 py-2">
        {picks.length === 0 ? (
          <div className="px-2 py-3 text-xs text-muted-foreground">
            No picks yet.
          </div>
        ) : (
          <ul className="space-y-1">
            {picks.map((p) => {
              const team = teamById.get(p.team_id);
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1 text-xs"
                >
                  <span className="w-6 font-mono text-muted-foreground">
                    {p.pick_number}.
                  </span>
                  {team?.flag_url && (
                    <img src={team.flag_url} alt="" className="h-3 w-4" />
                  )}
                  <span className="flex-1 truncate text-foreground">
                    {team?.name ?? "—"}
                  </span>
                  {p.was_autopick && (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      auto
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function PickHistory({
  picks,
  members,
  teamById,
}: {
  picks: H2HDraftPick[];
  members: MemberWithProfile[];
  teamById: Map<number, Team>;
}) {
  if (picks.length === 0) return null;
  const memberById = new Map(members.map((m) => [m.user_id, m]));
  const reversed = [...picks].sort((a, b) => b.pick_number - a.pick_number);
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-bold text-foreground">Pick history</h3>
      </div>
      <div className="max-h-[200px] overflow-y-auto px-2 py-2">
        <ul className="space-y-0.5">
          {reversed.map((p) => {
            const m = memberById.get(p.user_id);
            const team = teamById.get(p.team_id);
            return (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-muted-foreground"
              >
                <span className="w-6 font-mono">{p.pick_number}.</span>
                <span className="text-foreground">
                  {m?.profile?.display_name ?? "—"}
                </span>
                <span>picked</span>
                {team?.flag_url && (
                  <img src={team.flag_url} alt="" className="h-3 w-4" />
                )}
                <span className="text-foreground">{team?.name ?? "—"}</span>
                {p.was_autopick && (
                  <span className="ml-auto text-[10px] uppercase tracking-wide">
                    auto
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// Small synthesized beep using Web Audio; no asset needed.
function playBeep() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    osc.onended = () => ctx.close();
  } catch {
    /* no-op */
  }
}
