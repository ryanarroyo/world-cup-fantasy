"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type {
  H2HDraft,
  H2HDraftStatus,
  LeagueMember,
  Profile,
} from "@/lib/types/database";

type MemberWithProfile = LeagueMember & { profile: Profile | null };

export function H2HLobby({
  leagueId,
  initialDraft,
  members,
  initialReadyUserIds,
  currentUserId,
}: {
  leagueId: string;
  initialDraft: H2HDraft | null;
  members: MemberWithProfile[];
  initialReadyUserIds: string[];
  currentUserId: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [draftStatus, setDraftStatus] = useState<H2HDraftStatus>(
    initialDraft?.status ?? "LOBBY"
  );
  const [readyUserIds, setReadyUserIds] = useState<Set<string>>(
    () => new Set(initialReadyUserIds)
  );
  const [presentUserIds, setPresentUserIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const presenceKeyRef = useRef(currentUserId);

  const meReady = readyUserIds.has(currentUserId);

  useEffect(() => {
    const channel = supabase.channel(`h2h-lobby:${leagueId}`, {
      config: { presence: { key: presenceKeyRef.current } },
    });

    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "h2h_ready_states",
          filter: `league_id=eq.${leagueId}`,
        },
        (payload) => {
          setReadyUserIds((prev) => {
            const next = new Set(prev);
            if (payload.eventType === "INSERT") {
              next.add((payload.new as { user_id: string }).user_id);
            } else if (payload.eventType === "DELETE") {
              next.delete((payload.old as { user_id: string }).user_id);
            }
            return next;
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "h2h_drafts",
          filter: `league_id=eq.${leagueId}`,
        },
        (payload) => {
          const next = payload.new as { status: H2HDraftStatus };
          setDraftStatus(next.status);
          if (next.status === "DRAFTING") {
            router.refresh();
          }
        }
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setPresentUserIds(new Set(Object.keys(state)));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, leagueId, router]);

  const setReady = useCallback(
    async (ready: boolean) => {
      setBusy(true);
      setError(null);
      try {
        if (ready) {
          const { error: insertErr } = await supabase
            .from("h2h_ready_states")
            .insert({ league_id: leagueId, user_id: currentUserId });
          if (insertErr && insertErr.code !== "23505") throw insertErr;
        } else {
          const { error: deleteErr } = await supabase
            .from("h2h_ready_states")
            .delete()
            .eq("league_id", leagueId)
            .eq("user_id", currentUserId);
          if (deleteErr) throw deleteErr;
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setBusy(false);
      }
    },
    [supabase, leagueId, currentUserId]
  );

  if (draftStatus === "DRAFTING" || draftStatus === "COMPLETE") {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
        <p className="font-medium text-foreground">
          {draftStatus === "DRAFTING"
            ? "Draft starting…"
            : "Draft complete."}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          The draft room is coming in the next build. Hang tight.
        </p>
      </div>
    );
  }

  if (draftStatus === "CANCELLED") {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <p className="font-medium text-destructive">Draft cancelled.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          The draft deadline passed before both players readied up.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-bold text-foreground">Pre-draft lobby</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          The draft starts as soon as both players are ready.
        </p>
      </div>
      <div className="divide-y divide-border/50">
        {members.map((member) => {
          const isMe = member.user_id === currentUserId;
          const isReady = readyUserIds.has(member.user_id);
          const isOnline = presentUserIds.has(member.user_id);
          return (
            <div
              key={member.id}
              className="flex items-center gap-3 px-4 py-3"
            >
              <PresenceDot online={isOnline} />
              {member.profile?.avatar_url && (
                <img
                  src={member.profile.avatar_url}
                  alt=""
                  className="h-6 w-6 rounded-full"
                />
              )}
              <span
                className={`flex-1 text-sm ${isMe ? "font-semibold" : ""}`}
              >
                {member.profile?.display_name ?? "Unknown"}
                {isMe && (
                  <span className="ml-1.5 text-xs text-primary">(you)</span>
                )}
              </span>
              <ReadyBadge ready={isReady} />
            </div>
          );
        })}
      </div>
      <div className="border-t border-border px-4 py-3">
        {error && (
          <p className="mb-2 text-xs text-destructive">{error}</p>
        )}
        <button
          type="button"
          onClick={() => setReady(!meReady)}
          disabled={busy}
          className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${
            meReady
              ? "border border-border bg-background text-foreground hover:bg-muted"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          {meReady ? "Cancel ready" : "I'm ready"}
        </button>
      </div>
    </div>
  );
}

function PresenceDot({ online }: { online: boolean }) {
  return (
    <span
      title={online ? "Online" : "Offline"}
      className={`inline-block h-2 w-2 rounded-full ${
        online ? "bg-green-500" : "bg-muted-foreground/40"
      }`}
    />
  );
}

function ReadyBadge({ ready }: { ready: boolean }) {
  if (ready) {
    return (
      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
        Ready
      </span>
    );
  }
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      Not ready
    </span>
  );
}
