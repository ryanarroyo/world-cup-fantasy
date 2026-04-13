import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { League } from "@/lib/types/database";

export default async function LeaguesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get leagues the user is a member of
  const { data: memberships } = await supabase
    .from("league_members")
    .select("league_id")
    .eq("user_id", user!.id);

  const leagueIds = memberships?.map((m) => m.league_id) ?? [];

  // Also get leagues the user owns (they might not have joined their own)
  const { data: ownedLeagues } = await supabase
    .from("leagues")
    .select("id")
    .eq("owner_id", user!.id);

  const allIds = [
    ...new Set([
      ...leagueIds,
      ...(ownedLeagues?.map((l) => l.id) ?? []),
    ]),
  ];

  let leagues: (League & {
    member_count: number;
    members: { display_name: string; avatar_url: string | null }[];
  })[] = [];
  if (allIds.length > 0) {
    const { data } = await supabase
      .from("leagues")
      .select("*, league_members(count, profile:profiles(display_name, avatar_url))")
      .in("id", allIds);

    leagues = (data ?? []).map((l: any) => ({
      ...l,
      member_count: l.league_members?.[0]?.count ?? 0,
      members: (l.league_members ?? [])
        .map((m: any) => m.profile)
        .filter(Boolean),
    }));
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Leagues</h1>
        <div className="flex gap-2">
          <Link
            href="/leagues/join"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Join League
          </Link>
          <Link
            href="/leagues/create"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Create League
          </Link>
        </div>
      </div>

      {leagues.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            You haven&apos;t joined any leagues yet.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a league and invite your friends, or join one with an invite
            code.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {leagues.map((league) => (
            <Link
              key={league.id}
              href={`/leagues/${league.id}`}
              className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">
                    {league.name}
                  </h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {league.member_count}{" "}
                    {league.member_count === 1 ? "member" : "members"}
                    {league.owner_id === user!.id && (
                      <span className="ml-2 text-xs text-secondary">Owner</span>
                    )}
                  </p>
                  {league.members.length > 0 && (
                    <div className="mt-2 flex items-center gap-1.5">
                      {league.members.slice(0, 5).map((member, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          {member.avatar_url && (
                            <img
                              src={member.avatar_url}
                              alt=""
                              className="h-3.5 w-3.5 rounded-full"
                            />
                          )}
                          <span>{member.display_name}</span>
                        </div>
                      ))}
                      {league.members.length > 5 && (
                        <span className="text-xs text-muted-foreground">
                          +{league.members.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <svg
                  className="h-5 w-5 text-muted-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
