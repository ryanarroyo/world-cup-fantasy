import type { Profile, UserScore } from "@/lib/types/database";

const ROUNDS = [
  { key: "group_points" as const, label: "Group" },
  { key: "r32_points" as const, label: "R32" },
  { key: "r16_points" as const, label: "R16" },
  { key: "qf_points" as const, label: "QF" },
  { key: "sf_points" as const, label: "SF" },
  { key: "final_points" as const, label: "Final" },
];

export function RoundBreakdown({
  members,
  currentUserId,
}: {
  members: any[];
  currentUserId?: string;
}) {
  if (members.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-bold text-foreground">Points by Round</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-4 py-2 text-left font-medium">Player</th>
              {ROUNDS.map((r) => (
                <th key={r.key} className="px-2 py-2 text-center font-medium">
                  {r.label}
                </th>
              ))}
              <th
                className="px-2 py-2 text-center font-medium"
                title="Upset bonus points (capped: top 3 per round count)"
              >
                🎯
              </th>
              <th className="px-3 py-2 text-center font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member: any) => {
              const profile = member.profile as Profile | null;
              const score = member.user_score as UserScore | null;
              const isCurrentUser = member.user_id === currentUserId;

              return (
                <tr
                  key={member.id}
                  className={`border-b border-border/50 ${isCurrentUser ? "bg-primary/5" : ""}`}
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      {profile?.avatar_url && (
                        <img
                          src={profile.avatar_url}
                          alt=""
                          className="h-5 w-5 rounded-full"
                        />
                      )}
                      <span
                        className={`text-xs ${isCurrentUser ? "font-semibold" : ""}`}
                      >
                        {profile?.display_name ?? "Unknown"}
                      </span>
                    </div>
                  </td>
                  {ROUNDS.map((r) => (
                    <td
                      key={r.key}
                      className="px-2 py-2 text-center text-xs text-muted-foreground"
                    >
                      {score?.[r.key] ?? 0}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center text-xs font-medium text-amber-500">
                    {score?.upset_bonus_points
                      ? `+${score.upset_bonus_points}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-center text-xs font-bold">
                    {score?.total_points ?? 0}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
