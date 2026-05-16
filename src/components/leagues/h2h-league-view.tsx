import { InviteLink } from "@/components/leagues/invite-link";
import { DeleteLeague } from "@/components/leagues/delete-league";
import { H2HLobby } from "@/components/leagues/h2h-lobby";
import { H2HDraftRoom } from "@/components/leagues/h2h-draft-room";
import {
  H2HTournamentView,
  pickDefaultTournamentTab,
} from "@/components/leagues/h2h-tournament-view";
import type {
  H2HAutopickQueueEntry,
  H2HDraft,
  H2HDraftPick,
  H2HDraftStatus,
  H2HScore,
  H2HTeamStatus,
  League,
  LeagueMember,
  MatchWithTeams,
  Profile,
  Team,
} from "@/lib/types/database";

type MemberWithProfile = LeagueMember & { profile: Profile | null };
type TournamentTab = "scoreboard" | "rosters" | "bracket";

const STATUS_COPY: Record<
  H2HDraftStatus,
  { label: string; tone: "info" | "success" | "warn" | "muted" }
> = {
  LOBBY: { label: "Waiting for opponent", tone: "info" },
  READY: { label: "Both players ready", tone: "success" },
  DRAFTING: { label: "Draft in progress", tone: "success" },
  COMPLETE: { label: "Draft complete", tone: "muted" },
  CANCELLED: { label: "Cancelled", tone: "warn" },
};

export function H2HLeagueView({
  league,
  draft,
  members,
  readyUserIds,
  currentUserId,
  teams = [],
  picks = [],
  autopickQueue = [],
  scores = [],
  matches = [],
  teamStatuses = [],
  tournamentTab,
}: {
  league: League;
  draft: H2HDraft | null;
  members: MemberWithProfile[];
  readyUserIds: string[];
  currentUserId: string | undefined;
  teams?: Team[];
  picks?: H2HDraftPick[];
  autopickQueue?: H2HAutopickQueueEntry[];
  scores?: H2HScore[];
  matches?: MatchWithTeams[];
  teamStatuses?: H2HTeamStatus[];
  tournamentTab?: string;
}) {
  const isOwner = league.owner_id === currentUserId;
  const memberCount = members.length;
  const needsOpponent = memberCount < 2;
  const status: H2HDraftStatus = draft?.status ?? "LOBBY";
  const statusCopy = STATUS_COPY[status];
  const isDrafting = status === "DRAFTING";
  const isComplete = status === "COMPLETE";
  const showLobby =
    !needsOpponent &&
    currentUserId !== undefined &&
    !isDrafting &&
    !isComplete &&
    status !== "CANCELLED";
  const showDraftRoom =
    isDrafting &&
    draft !== null &&
    currentUserId !== undefined &&
    members.length === 2;
  const showTournament =
    isComplete &&
    currentUserId !== undefined &&
    members.length === 2;

  const resolvedTab: TournamentTab = (() => {
    if (
      tournamentTab === "scoreboard" ||
      tournamentTab === "rosters" ||
      tournamentTab === "bracket"
    ) {
      return tournamentTab;
    }
    return pickDefaultTournamentTab(matches);
  })();

  const showHeaderChrome = !showDraftRoom && !showTournament;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-secondary/10 px-2 py-0.5 text-xs font-medium text-secondary">
              Head-to-Head Draft
            </div>
            <h1 className="text-2xl font-bold">{league.name}</h1>
            <p className="text-sm text-muted-foreground">
              {memberCount} / 2 players
            </p>
          </div>
          {isOwner && <DeleteLeague leagueId={league.id} />}
        </div>
      </div>

      {showHeaderChrome && <StatusBanner statusCopy={statusCopy} />}

      {needsOpponent && (
        <div className="mb-6 rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2 text-sm font-medium text-foreground">
            Invite your opponent
          </h3>
          <InviteLink inviteCode={league.invite_code} />
        </div>
      )}

      {showTournament ? (
        <div className="mb-6">
          <H2HTournamentView
            league={league}
            members={members}
            teams={teams}
            initialScores={scores}
            initialMatches={matches}
            initialTeamStatuses={teamStatuses}
            initialTab={resolvedTab}
            currentUserId={currentUserId!}
          />
        </div>
      ) : showDraftRoom ? (
        <div className="mb-6">
          <H2HDraftRoom
            leagueId={league.id}
            initialDraft={draft!}
            members={members}
            teams={teams}
            initialPicks={picks}
            initialQueue={autopickQueue}
            currentUserId={currentUserId!}
          />
        </div>
      ) : showLobby ? (
        <div className="mb-6">
          <H2HLobby
            leagueId={league.id}
            initialDraft={draft}
            members={members}
            initialReadyUserIds={readyUserIds}
            currentUserId={currentUserId!}
          />
        </div>
      ) : (
        <div className="mb-6 rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-bold text-foreground">Players</h3>
          </div>
          <div className="divide-y divide-border/50">
            {members.map((member) => {
              const isCurrentUser = member.user_id === currentUserId;
              return (
                <div
                  key={member.id}
                  className={`flex items-center gap-2 px-4 py-3 ${
                    isCurrentUser ? "bg-primary/5" : ""
                  }`}
                >
                  {member.profile?.avatar_url && (
                    <img
                      src={member.profile.avatar_url}
                      alt=""
                      className="h-6 w-6 rounded-full"
                    />
                  )}
                  <span
                    className={`text-sm ${
                      isCurrentUser ? "font-semibold" : ""
                    }`}
                  >
                    {member.profile?.display_name ?? "Unknown"}
                  </span>
                  {isCurrentUser && (
                    <span className="text-xs text-primary">(you)</span>
                  )}
                </div>
              );
            })}
            {needsOpponent && (
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                <div className="h-6 w-6 rounded-full border border-dashed border-border" />
                <span>Waiting for opponent…</span>
              </div>
            )}
          </div>
        </div>
      )}

      {showHeaderChrome && <RulesCard />}
    </div>
  );
}

function StatusBanner({
  statusCopy,
}: {
  statusCopy: { label: string; tone: "info" | "success" | "warn" | "muted" };
}) {
  const toneClass = {
    info: "border-border bg-muted text-foreground",
    success: "border-primary/30 bg-primary/5 text-foreground",
    warn: "border-destructive/30 bg-destructive/5 text-destructive",
    muted: "border-border bg-card text-muted-foreground",
  }[statusCopy.tone];

  return (
    <div
      className={`mb-6 rounded-xl border px-4 py-3 text-sm font-medium ${toneClass}`}
    >
      {statusCopy.label}
    </div>
  );
}

function RulesCard() {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-bold text-foreground">How it works</h3>
      </div>
      <div className="space-y-3 px-4 py-4 text-sm text-muted-foreground">
        <p>
          Two players snake-draft all 48 World Cup teams (24 each), 60
          seconds per pick.
        </p>
        <p>Points are awarded cumulatively each round a team survives:</p>
        <table className="w-full text-xs">
          <tbody className="divide-y divide-border/50">
            {[
              ["Advanced from group", "2"],
              ["Won R32", "4"],
              ["Won R16", "8"],
              ["Won QF", "12"],
              ["Won SF", "16"],
              ["Won Final (champion)", "20"],
            ].map(([label, pts]) => (
              <tr key={label}>
                <td className="py-1.5 pr-2 text-foreground">{label}</td>
                <td className="py-1.5 text-right font-mono text-foreground">
                  +{pts}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="pt-1 text-xs">
          Ties are broken by: champion ownership → runner-up ownership → SF
          teams → QF teams → total goals scored.
        </p>
      </div>
    </div>
  );
}
