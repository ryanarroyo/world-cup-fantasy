"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { H2HScoreboard } from "@/components/leagues/h2h-tournament/scoreboard";
import { H2HRosters } from "@/components/leagues/h2h-tournament/rosters";
import { H2HBracket } from "@/components/leagues/h2h-tournament/bracket";
import type { TournamentTab } from "@/lib/h2h/tabs";
import type {
  H2HScore,
  H2HTeamStatus,
  League,
  LeagueMember,
  MatchWithTeams,
  Profile,
  Team,
} from "@/lib/types/database";

type MemberWithProfile = LeagueMember & { profile: Profile | null };

const TAB_VALUES: TournamentTab[] = ["scoreboard", "rosters", "bracket"];

export function H2HTournamentView({
  league,
  members,
  teams,
  initialScores,
  initialMatches,
  initialTeamStatuses,
  initialTab,
  currentUserId,
}: {
  league: League;
  members: MemberWithProfile[];
  teams: Team[];
  initialScores: H2HScore[];
  initialMatches: MatchWithTeams[];
  initialTeamStatuses: H2HTeamStatus[];
  initialTab: TournamentTab;
  currentUserId: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [scores, setScores] = useState<H2HScore[]>(initialScores);
  const [tab, setTab] = useState<TournamentTab>(initialTab);

  const teamById = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams]
  );

  const ownerOfTeam = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of initialTeamStatuses) m.set(s.team_id, s.user_id);
    return m;
  }, [initialTeamStatuses]);

  // Stable ownership colors: first member (by join order) → blue, second → amber.
  const { ownerBorderColors, ownerRingColors } = useMemo(() => {
    const border = new Map<string, string>();
    const ring = new Map<string, string>();
    members.forEach((m, idx) => {
      if (idx === 0) {
        border.set(m.user_id, "border-blue-500");
        ring.set(m.user_id, "ring-blue-500");
      } else {
        border.set(m.user_id, "border-amber-500");
        ring.set(m.user_id, "ring-amber-500");
      }
    });
    return { ownerBorderColors: border, ownerRingColors: ring };
  }, [members]);

  // Realtime subscriptions: scores change frequently as matches finish.
  // Match updates are already handled by RealtimeProvider in the root layout
  // (it router.refresh()es on every matches UPDATE), so we don't duplicate
  // the listener here.
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      // Push the user's JWT to Realtime before subscribing so RLS evaluates
      // h2h_scores events as the authenticated user instead of anon.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session?.access_token) {
        await supabase.realtime.setAuth(data.session.access_token);
      }
      if (cancelled) return;

      channel = supabase
        .channel(`h2h-tournament:${league.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "h2h_scores",
            filter: `league_id=eq.${league.id}`,
          },
          (payload) => {
            if (payload.eventType === "DELETE") return;
            const next = payload.new as H2HScore;
            setScores((prev) => {
              const filtered = prev.filter((s) => s.user_id !== next.user_id);
              return [...filtered, next];
            });
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase, league.id]);

  const changeTab = (next: TournamentTab) => {
    setTab(next);
    router.push(`/leagues/${league.id}?tab=${next}`, { scroll: false });
  };

  const upcoming = useMemo(
    () =>
      initialMatches
        .filter((m) => m.status !== "FINISHED")
        .sort(
          (a, b) =>
            new Date(a.kickoff_at).getTime() -
            new Date(b.kickoff_at).getTime()
        ),
    [initialMatches]
  );

  const tournamentStarted = useMemo(
    () => initialMatches.some((m) => m.status === "FINISHED"),
    [initialMatches]
  );

  const firstKickoff = useMemo(() => {
    if (tournamentStarted) return null;
    const next = upcoming[0];
    return next ? new Date(next.kickoff_at) : null;
  }, [upcoming, tournamentStarted]);

  return (
    <div className="space-y-4">
      {!tournamentStarted && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">Draft locked in.</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {firstKickoff ? (
              <>
                Tournament kicks off{" "}
                <span suppressHydrationWarning>
                  {firstKickoff.toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                . The scoreboard will activate as matches finish.
              </>
            ) : (
              "The scoreboard will activate once the tournament begins."
            )}
          </p>
        </div>
      )}

      <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
        {TAB_VALUES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => changeTab(t)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "scoreboard" && (
        <H2HScoreboard
          members={members}
          scores={scores}
          ownerColors={ownerBorderColors}
          upcomingMatches={upcoming}
          currentUserId={currentUserId}
          ownerOfTeam={ownerOfTeam}
        />
      )}

      {tab === "rosters" && (
        <H2HRosters
          members={members}
          teamById={teamById}
          teamStatuses={initialTeamStatuses}
          ownerColors={ownerBorderColors}
          currentUserId={currentUserId}
        />
      )}

      {tab === "bracket" && (
        <H2HBracket
          matches={initialMatches}
          ownerOfTeam={ownerOfTeam}
          ownerRingColors={ownerRingColors}
        />
      )}
    </div>
  );
}

