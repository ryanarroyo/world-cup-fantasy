"use client";

import { useMemo } from "react";
import {
  CUMULATIVE_POINTS,
  DEPTH_LABELS,
  DEPTH_SHORT_LABELS,
} from "@/lib/h2h/scoring";
import type {
  H2HTeamStatus,
  LeagueMember,
  Profile,
  Team,
} from "@/lib/types/database";

type MemberWithProfile = LeagueMember & { profile: Profile | null };

export function H2HRosters({
  members,
  teamById,
  teamStatuses,
  ownerColors,
  currentUserId,
}: {
  members: MemberWithProfile[];
  teamById: Map<number, Team>;
  teamStatuses: H2HTeamStatus[];
  ownerColors: Map<string, string>;
  currentUserId: string;
}) {
  const sortedMembers = useMemo(() => {
    const me = members.find((m) => m.user_id === currentUserId);
    const opp = members.find((m) => m.user_id !== currentUserId);
    return [me, opp].filter((x): x is MemberWithProfile => Boolean(x));
  }, [members, currentUserId]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {sortedMembers.map((m) => (
        <PlayerRoster
          key={m.id}
          member={m}
          teamById={teamById}
          teamStatuses={teamStatuses.filter((s) => s.user_id === m.user_id)}
          accentColor={ownerColors.get(m.user_id) ?? "border-border"}
          isCurrent={m.user_id === currentUserId}
        />
      ))}
    </div>
  );
}

function PlayerRoster({
  member,
  teamById,
  teamStatuses,
  accentColor,
  isCurrent,
}: {
  member: MemberWithProfile;
  teamById: Map<number, Team>;
  teamStatuses: H2HTeamStatus[];
  accentColor: string;
  isCurrent: boolean;
}) {
  const alive = teamStatuses
    .filter((s) => s.alive !== false && s.locked_depth !== "NOT_ADVANCED")
    .sort((a, b) => depthRank(b.projected_depth) - depthRank(a.projected_depth));
  const eliminated = teamStatuses
    .filter((s) => s.alive === false || s.locked_depth === "NOT_ADVANCED")
    .sort((a, b) => depthRank(b.locked_depth) - depthRank(a.locked_depth));

  return (
    <div className={`rounded-xl border-2 ${accentColor} bg-card`}>
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        {member.profile?.avatar_url && (
          <img
            src={member.profile.avatar_url}
            alt=""
            className="h-6 w-6 rounded-full"
          />
        )}
        <span className="text-sm font-semibold text-foreground">
          {member.profile?.display_name ?? "Unknown"}
          {isCurrent && (
            <span className="ml-1.5 text-xs text-primary">(you)</span>
          )}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {teamStatuses.length} teams
        </span>
      </div>

      <RosterSection
        title="Still alive"
        statuses={alive}
        teamById={teamById}
        useProjected
      />
      <RosterSection
        title="Eliminated"
        statuses={eliminated}
        teamById={teamById}
        useProjected={false}
      />
    </div>
  );
}

function RosterSection({
  title,
  statuses,
  teamById,
  useProjected,
}: {
  title: string;
  statuses: H2HTeamStatus[];
  teamById: Map<number, Team>;
  useProjected: boolean;
}) {
  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground">
        <span className="font-medium uppercase tracking-wide">{title}</span>
        <span>{statuses.length}</span>
      </div>
      {statuses.length === 0 ? (
        <div className="px-4 pb-3 text-xs text-muted-foreground">None.</div>
      ) : (
        <ul className="divide-y divide-border/50 px-2 pb-2">
          {statuses.map((s) => {
            const team = teamById.get(s.team_id);
            const depth = useProjected ? s.projected_depth : s.locked_depth;
            const points = depth ? CUMULATIVE_POINTS[depth] : 0;
            return (
              <li
                key={s.team_id}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs"
              >
                {team?.flag_url && (
                  <img src={team.flag_url} alt="" className="h-3 w-4" />
                )}
                <span className="flex-1 truncate text-foreground">
                  {team?.name ?? "—"}
                </span>
                <span className="text-muted-foreground">
                  {depth ? DEPTH_SHORT_LABELS[depth] : "—"}
                </span>
                <span
                  className="w-8 text-right font-mono text-foreground"
                  title={depth ? DEPTH_LABELS[depth] : undefined}
                >
                  {points}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function depthRank(depth: H2HTeamStatus["projected_depth"] | null): number {
  switch (depth) {
    case "CHAMPION":
      return 7;
    case "FINAL":
      return 6;
    case "SF":
      return 5;
    case "QF":
      return 4;
    case "R16":
      return 3;
    case "R32":
      return 2;
    case "NOT_ADVANCED":
      return 1;
    default:
      return 0;
  }
}
