import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { StatsDisplay } from "@/components/stats/stats-display";
import type { UserStats } from "@/lib/types/database";

export default async function StatsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/stats");

  const { data: stats, error } = await supabase.rpc("get_user_stats", {
    p_user_id: user.id,
  });

  const userStats = (stats ?? {}) as UserStats;
  const hasData = userStats.total_predictions > 0;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Your Stats</h1>
        <p className="text-sm text-muted-foreground">
          Personal prediction analytics and performance breakdown.
        </p>
      </div>

      {hasData ? (
        <StatsDisplay stats={userStats} />
      ) : (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <div className="text-4xl">📊</div>
          <h3 className="mt-4 text-lg font-semibold text-foreground">
            No Stats Yet
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Start making predictions to see your analytics here. Stats will
            populate once matches are played and scored.
          </p>
        </div>
      )}
    </div>
  );
}
