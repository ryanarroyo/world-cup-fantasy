import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { InviteLink } from "@/components/leagues/invite-link";
import { RoundBreakdown } from "@/components/leagues/round-breakdown";
import { RecentActivity } from "@/components/leagues/recent-activity";
import { MatchPredictions } from "@/components/leagues/match-predictions";
import type { Profile, UserScore } from "@/lib/types/database";
import { LeagueTabs } from "./league-tabs";

export default async function LeagueDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = "standings" } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: league } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", id)
    .single();

  if (!league) notFound();

  // Get members with profiles and scores
  const { data: members } = await supabase
    .from("league_members")
    .select("*, profile:profiles(*), user_score:user_scores(*)")
    .eq("league_id", id)
    .order("joined_at");

  const sortedMembers = (members ?? []).sort((a: any, b: any) => {
    const aScore = a.user_score?.total_points ?? 0;
    const bScore = b.user_score?.total_points ?? 0;
    return bScore - aScore;
  });

  const memberUserIds = sortedMembers.map((m: any) => m.user_id);

  // For recent activity & match predictions: fetch finished matches and predictions
  let recentMatches: any[] = [];
  let matchPredictions: any[] = [];

  if (tab === "activity" || tab === "predictions") {
    const { data: finishedMatches } = await supabase
      .from("matches")
      .select(
        "*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)"
      )
      .eq("status", "FINISHED")
      .order("updated_at", { ascending: false })
      .limit(tab === "activity" ? 10 : 50);

    recentMatches = finishedMatches ?? [];

    if (recentMatches.length > 0) {
      const matchIds = recentMatches.map((m: any) => m.id);
      const { data: predictions } = await supabase
        .from("predictions")
        .select("*")
        .in("match_id", matchIds)
        .in("user_id", memberUserIds);

      matchPredictions = predictions ?? [];
    }
  }

  const isOwner = league.owner_id === user?.id;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{league.name}</h1>
        <p className="text-sm text-muted-foreground">
          {sortedMembers.length}{" "}
          {sortedMembers.length === 1 ? "member" : "members"}
        </p>
      </div>

      {/* Invite section */}
      <div className="mb-6 rounded-xl border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-medium text-foreground">
          Invite Friends
        </h3>
        <InviteLink inviteCode={league.invite_code} />
      </div>

      {/* Tabs */}
      <LeagueTabs currentTab={tab} leagueId={id} />

      {/* Tab content */}
      {tab === "standings" && (
        <div className="mt-4 space-y-6">
          {/* Leaderboard */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-bold text-foreground">Leaderboard</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium">#</th>
                    <th className="px-4 py-2 text-left font-medium">Player</th>
                    <th className="px-2 py-2 text-center font-medium">Pts</th>
                    <th className="hidden px-2 py-2 text-center font-medium sm:table-cell">
                      Correct
                    </th>
                    <th className="hidden px-2 py-2 text-center font-medium sm:table-cell">
                      Exact
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMembers.map((member: any, index: number) => {
                    const profile = member.profile as Profile | null;
                    const score = member.user_score as UserScore | null;
                    const isCurrentUser = member.user_id === user?.id;

                    return (
                      <tr
                        key={member.id}
                        className={`border-b border-border/50 ${isCurrentUser ? "bg-primary/5" : ""}`}
                      >
                        <td className="px-4 py-2.5 font-bold text-muted-foreground">
                          {index + 1}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            {profile?.avatar_url && (
                              <img
                                src={profile.avatar_url}
                                alt=""
                                className="h-6 w-6 rounded-full"
                              />
                            )}
                            <span
                              className={isCurrentUser ? "font-semibold" : ""}
                            >
                              {profile?.display_name ?? "Unknown"}
                            </span>
                            {isCurrentUser && (
                              <span className="text-xs text-primary">
                                (you)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-center font-bold">
                          {score?.total_points ?? 0}
                        </td>
                        <td className="hidden px-2 py-2.5 text-center text-muted-foreground sm:table-cell">
                          {score?.correct_results ?? 0}
                        </td>
                        <td className="hidden px-2 py-2.5 text-center text-muted-foreground sm:table-cell">
                          {score?.correct_scores ?? 0}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {sortedMembers.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No members yet. Share the invite code to get started.
              </div>
            )}
          </div>

          {/* Points by round */}
          <RoundBreakdown members={sortedMembers} currentUserId={user?.id} />
        </div>
      )}

      {tab === "activity" && (
        <div className="mt-4">
          <RecentActivity
            matches={recentMatches}
            predictions={matchPredictions}
            members={sortedMembers}
            currentUserId={user?.id}
          />
        </div>
      )}

      {tab === "predictions" && (
        <div className="mt-4">
          <MatchPredictions
            matches={recentMatches}
            predictions={matchPredictions}
            members={sortedMembers}
            currentUserId={user?.id}
          />
        </div>
      )}
    </div>
  );
}
