"use client";

import type {
  H2HScore,
  LeagueMember,
  MatchWithTeams,
  Profile,
} from "@/lib/types/database";

type MemberWithProfile = LeagueMember & { profile: Profile | null };

export function H2HScoreboard({
  members,
  scores,
  ownerColors,
  upcomingMatches,
  currentUserId,
  ownerOfTeam,
}: {
  members: MemberWithProfile[];
  scores: H2HScore[];
  ownerColors: Map<string, string>;
  upcomingMatches: MatchWithTeams[];
  currentUserId: string;
  ownerOfTeam: Map<number, string>;
}) {
  const scoreByUser = new Map(scores.map((s) => [s.user_id, s]));

  const sortedMembers = [...members].sort((a, b) => {
    const sa = scoreByUser.get(a.user_id);
    const sb = scoreByUser.get(b.user_id);
    return (sb?.locked_points ?? 0) - (sa?.locked_points ?? 0);
  });

  const me = sortedMembers.find((m) => m.user_id === currentUserId);
  const opponent = sortedMembers.find((m) => m.user_id !== currentUserId);

  const myScore = me ? scoreByUser.get(me.user_id) : undefined;
  const oppScore = opponent ? scoreByUser.get(opponent.user_id) : undefined;

  const lockedDelta = (myScore?.locked_points ?? 0) - (oppScore?.locked_points ?? 0);
  const projDelta = (myScore?.projected_points ?? 0) - (oppScore?.projected_points ?? 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {[me, opponent].map((m) =>
          m ? (
            <PlayerScoreCard
              key={m.id}
              member={m}
              score={scoreByUser.get(m.user_id)}
              accentColor={ownerColors.get(m.user_id) ?? "border-border"}
              isCurrent={m.user_id === currentUserId}
            />
          ) : null
        )}
      </div>

      <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Locked delta (vs opp)</span>
          <span
            className={`font-mono font-semibold ${
              lockedDelta > 0
                ? "text-primary"
                : lockedDelta < 0
                ? "text-destructive"
                : "text-foreground"
            }`}
          >
            {lockedDelta > 0 ? "+" : ""}
            {lockedDelta}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-muted-foreground">Projected delta</span>
          <span
            className={`font-mono font-semibold ${
              projDelta > 0
                ? "text-primary"
                : projDelta < 0
                ? "text-destructive"
                : "text-foreground"
            }`}
          >
            {projDelta > 0 ? "+" : ""}
            {projDelta}
          </span>
        </div>
      </div>

      <SwingPanel
        upcomingMatches={upcomingMatches}
        ownerOfTeam={ownerOfTeam}
        members={members}
        currentUserId={currentUserId}
      />
    </div>
  );
}

function PlayerScoreCard({
  member,
  score,
  accentColor,
  isCurrent,
}: {
  member: MemberWithProfile;
  score: H2HScore | undefined;
  accentColor: string;
  isCurrent: boolean;
}) {
  const locked = score?.locked_points ?? 0;
  const projected = score?.projected_points ?? 0;
  const projectedExtra = projected - locked;
  return (
    <div className={`rounded-xl border-2 ${accentColor} bg-card p-4`}>
      <div className="flex items-center gap-2">
        {member.profile?.avatar_url && (
          <img
            src={member.profile.avatar_url}
            alt=""
            className="h-7 w-7 rounded-full"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground">
            {member.profile?.display_name ?? "Unknown"}
            {isCurrent && (
              <span className="ml-1.5 text-xs text-primary">(you)</span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="tabular-nums text-4xl font-bold text-foreground">
          {locked}
        </span>
        <span className="text-xs text-muted-foreground">locked</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        Projected {projected}
        {projectedExtra > 0 && (
          <span className="ml-1 text-primary">(+{projectedExtra})</span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <Stat label="Alive" value={score?.teams_alive ?? 0} />
        <Stat label="Out" value={score?.teams_eliminated ?? 0} />
        <Stat label="QF teams" value={score?.qf_teams_count ?? 0} />
        <Stat label="SF teams" value={score?.sf_teams_count ?? 0} />
        <Stat label="Goals" value={score?.total_goals ?? 0} />
        <Stat
          label="Crown"
          value={
            score?.champion_owned
              ? "🏆"
              : score?.runner_up_owned
              ? "🥈"
              : "—"
          }
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className="font-mono text-foreground">{value}</span>
    </div>
  );
}

function SwingPanel({
  upcomingMatches,
  ownerOfTeam,
  members,
  currentUserId,
}: {
  upcomingMatches: MatchWithTeams[];
  ownerOfTeam: Map<number, string>;
  members: MemberWithProfile[];
  currentUserId: string;
}) {
  const memberById = new Map(members.map((m) => [m.user_id, m]));
  const next = upcomingMatches
    .filter((m) => m.status !== "FINISHED")
    .filter(
      (m) =>
        (m.home_team_id !== null && ownerOfTeam.has(m.home_team_id)) ||
        (m.away_team_id !== null && ownerOfTeam.has(m.away_team_id))
    )
    .slice(0, 3);

  if (next.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        No upcoming matches with your drafted teams.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-bold text-foreground">Next swing matches</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Upcoming matches that could move the scoreboard.
        </p>
      </div>
      <ul className="divide-y divide-border/50">
        {next.map((match) => {
          const homeOwner = match.home_team_id
            ? ownerOfTeam.get(match.home_team_id)
            : null;
          const awayOwner = match.away_team_id
            ? ownerOfTeam.get(match.away_team_id)
            : null;
          const homeOwnerName =
            (homeOwner && memberById.get(homeOwner)?.profile?.display_name) ??
            null;
          const awayOwnerName =
            (awayOwner && memberById.get(awayOwner)?.profile?.display_name) ??
            null;
          return (
            <li key={match.id} className="px-4 py-2.5">
              <div className="flex items-center gap-2 text-sm">
                {match.home_team?.flag_url && (
                  <img
                    src={match.home_team.flag_url}
                    alt=""
                    className="h-3 w-4"
                  />
                )}
                <span
                  className={`font-medium ${
                    homeOwner === currentUserId ? "text-primary" : "text-foreground"
                  }`}
                >
                  {match.home_team?.code ?? "TBD"}
                </span>
                <span className="text-xs text-muted-foreground">vs</span>
                <span
                  className={`font-medium ${
                    awayOwner === currentUserId ? "text-primary" : "text-foreground"
                  }`}
                >
                  {match.away_team?.code ?? "TBD"}
                </span>
                {match.away_team?.flag_url && (
                  <img
                    src={match.away_team.flag_url}
                    alt=""
                    className="h-3 w-4"
                  />
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(match.kickoff_at).toLocaleString(undefined, {
                    weekday: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {match.round} ·{" "}
                {homeOwnerName ? `${homeOwnerName} owns home` : "home unowned"}
                {" · "}
                {awayOwnerName ? `${awayOwnerName} owns away` : "away unowned"}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
