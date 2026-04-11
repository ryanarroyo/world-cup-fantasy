"use client";

import { useRouter } from "next/navigation";

const TABS = [
  { value: "standings", label: "Standings" },
  { value: "activity", label: "Recent Activity" },
  { value: "predictions", label: "Match Predictions" },
];

export function LeagueTabs({
  currentTab,
  leagueId,
}: {
  currentTab: string;
  leagueId: string;
}) {
  const router = useRouter();

  return (
    <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() =>
            router.push(`/leagues/${leagueId}?tab=${tab.value}`)
          }
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            currentTab === tab.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
