export type Team = {
  id: number;
  name: string;
  code: string;
  flag_url: string;
  group_letter: string;
  api_football_id: number | null;
  fifa_rank: number | null;
  pot: 1 | 2 | 3 | 4 | null;
  created_at: string;
};

export type Match = {
  id: number;
  round: "GROUP" | "R32" | "R16" | "QF" | "SF" | "3RD" | "FINAL";
  group_letter: string | null;
  match_number: number;
  home_team_id: number | null;
  away_team_id: number | null;
  home_score: number | null;
  away_score: number | null;
  home_penalties: number | null;
  away_penalties: number | null;
  winner_team_id: number | null;
  status: "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED";
  kickoff_at: string;
  venue: string | null;
  api_football_id: number | null;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Prediction = {
  id: number;
  user_id: string;
  match_id: number;
  predicted_home: number;
  predicted_away: number;
  predicted_winner_id: number | null;
  is_confident: boolean;
  points_earned: number;
  upset_bonus: number;
  created_at: string;
  updated_at: string;
};

export type UserStats = {
  total_predictions: number;
  correct_results: number;
  exact_scores: number;
  total_points: number;
  result_accuracy_pct: number;
  exact_accuracy_pct: number;
  points_per_match: number;
  best_round: { round: string; points: number } | null;
  worst_round: { round: string; points: number } | null;
  favorite_scoreline: { scoreline: string; count: number } | null;
  tendency: { home_wins: number; away_wins: number; draws: number };
  current_streak: number;
  confident_picks: number;
  confident_correct: number;
  upset_picks_landed: number;
  upset_bonus_earned: number;
  biggest_upset: {
    bonus: number;
    home_code: string;
    away_code: string;
    home_score: number;
    away_score: number;
    home_rank: number;
    away_rank: number;
  } | null;
  round_breakdown: Array<{
    round: string;
    predictions: number;
    points: number;
    avg_points: number;
  }> | null;
};

export type LeagueMode = "PREDICTIONS" | "H2H_DRAFT";

export type League = {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  max_members: number;
  mode: LeagueMode;
  created_at: string;
};

export type LeagueMember = {
  id: number;
  league_id: string;
  user_id: string;
  joined_at: string;
};

export type UserScore = {
  user_id: string;
  total_points: number;
  group_points: number;
  r32_points: number;
  r16_points: number;
  qf_points: number;
  sf_points: number;
  final_points: number;
  upset_bonus_points: number;
  correct_results: number;
  correct_scores: number;
  updated_at: string;
};

// Joined types for UI
export type MatchWithTeams = Match & {
  home_team: Team | null;
  away_team: Team | null;
  winner_team: Team | null;
};

export type PredictionWithMatch = Prediction & {
  match: MatchWithTeams;
};

export type LeagueMemberWithProfile = LeagueMember & {
  profile: Profile;
  user_score: UserScore | null;
};

// H2H Draft mode ------------------------------------------------------------

export type H2HDraftStatus =
  | "LOBBY"
  | "READY"
  | "DRAFTING"
  | "COMPLETE"
  | "CANCELLED";

export type H2HDraft = {
  league_id: string;
  status: H2HDraftStatus;
  first_pick_user_id: string | null;
  current_pick_number: number;
  current_turn_started_at: string | null;
  created_at: string;
  updated_at: string;
};

export type H2HDraftPick = {
  id: number;
  league_id: string;
  pick_number: number;
  user_id: string;
  team_id: number;
  was_autopick: boolean;
  picked_at: string;
};

export type H2HAutopickQueueEntry = {
  league_id: string;
  user_id: string;
  team_id: number;
  priority: 1 | 2 | 3;
};

export type H2HScore = {
  league_id: string;
  user_id: string;
  locked_points: number;
  projected_points: number;
  teams_alive: number;
  teams_eliminated: number;
  champion_owned: boolean;
  runner_up_owned: boolean;
  sf_teams_count: number;
  qf_teams_count: number;
  total_goals: number;
  updated_at: string;
};

// Joined types for UI
export type H2HDraftPickWithTeam = H2HDraftPick & {
  team: Team;
};

export type H2HScoreWithProfile = H2HScore & {
  profile: Profile;
};
