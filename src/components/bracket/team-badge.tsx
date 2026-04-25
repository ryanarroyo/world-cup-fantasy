import type { Team } from "@/lib/types/database";

const POT_COLORS: Record<number, string> = {
  1: "bg-yellow-400", // gold
  2: "bg-zinc-300", // silver
  3: "bg-amber-700", // bronze
  4: "bg-zinc-500", // muted
};

export function PotDot({ pot, className = "" }: { pot: number | null; className?: string }) {
  if (!pot) return null;
  return (
    <span
      title={`Pot ${pot}`}
      aria-label={`Pot ${pot}`}
      className={`inline-block h-1.5 w-1.5 rounded-full ${POT_COLORS[pot]} ${className}`}
    />
  );
}

export function TeamBadge({
  team,
  size = "sm",
  showRank = false,
  showPot = false,
}: {
  team: Team | null;
  size?: "sm" | "md";
  showRank?: boolean;
  showPot?: boolean;
}) {
  if (!team) {
    return (
      <div className="flex items-center gap-2">
        <div
          className={`rounded bg-muted ${size === "sm" ? "h-5 w-7" : "h-6 w-8"}`}
        />
        <span className="text-xs text-muted-foreground">TBD</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <img
        src={team.flag_url}
        alt={team.name}
        className={size === "sm" ? "h-4 w-6" : "h-5 w-7"}
      />
      <span className={`font-medium ${size === "sm" ? "text-xs" : "text-sm"}`}>
        {team.code}
      </span>
      {showPot && <PotDot pot={team.pot} />}
      {showRank && team.fifa_rank && (
        <span
          className="text-[10px] font-normal text-muted-foreground"
          title={`FIFA Ranking: #${team.fifa_rank}`}
        >
          #{team.fifa_rank}
        </span>
      )}
    </div>
  );
}
