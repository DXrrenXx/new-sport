// 与数据库表结构对应的类型定义。
// result 取值统一为 pending/home_win/away_win/draw；status 取值 pending/in_progress/completed。

export type MatchResult = 'pending' | 'home_win' | 'away_win' | 'draw';
export type MatchStatus = 'pending' | 'in_progress' | 'completed';

export interface Grade {
  id: number;
  name: string;
  display_order: number;
}

export interface ScoringRules {
  win: number;
  draw: number;
  loss: number;
  allow_draw: boolean;
}

export interface Sport {
  id: number;
  name: string;
  scoring_rules: ScoringRules;
}

export interface ClassRow {
  id: number;
  name: string;
  grade_id: number;
}

export interface Match {
  id: number;
  grade_id: number;
  sport_id: number;
  week: number;
  home_class_id: number;
  away_class_id: number;
  home_score: number | null;
  away_score: number | null;
  result: MatchResult;
  status: MatchStatus;
  created_at: string;
  updated_at: string;
}

// 前台/后台列表用的富化比赛（带名称）
export interface EnrichedMatch extends Match {
  home_class_name: string;
  away_class_name: string;
  sport_name: string;
  grade_name: string;
}

export interface SportRanking {
  id: number;
  grade_id: number;
  sport_id: number;
  class_id: number;
  points: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface TotalRanking {
  id: number;
  grade_id: number;
  class_id: number;
  total_points: number;
}

export interface AdminLog {
  id: number;
  actor_email: string;
  action_type: string;
  detail: Record<string, unknown>;
  created_at: string;
}
