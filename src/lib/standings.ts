// 小组赛积分榜计算（前端共用）：前台分组排行榜与后台出线快照使用同一套算法，保证显示一致。
import type { EnrichedMatch, ScoringRules } from './types';

export interface StandingRow {
  classId: number;
  name: string;
  points: number;
  wins: number;
  losses: number;
  draws: number;
}

// 按 group_label 汇总小组赛积分（只统计已完成的比赛），排序：积分↓ → 胜场↓ → 负场↑
export function computeStandings(
  groupMatches: EnrichedMatch[],
  rules: ScoringRules,
  classMap: Map<number, string>,
): Map<string, StandingRow[]> {
  const win = rules.win | 0;
  const draw = rules.draw | 0;
  const loss = rules.loss | 0;
  const byGroup = new Map<string, Map<number, StandingRow>>();

  for (const m of groupMatches) {
    if (m.stage !== 'group' || m.result === 'pending' || !m.group_label) continue;
    if (m.home_class_id == null || m.away_class_id == null) continue;
    if (!byGroup.has(m.group_label)) byGroup.set(m.group_label, new Map());
    const map = byGroup.get(m.group_label)!;
    const H = map.get(m.home_class_id) ?? { classId: m.home_class_id, name: classMap.get(m.home_class_id) ?? '?', points: 0, wins: 0, losses: 0, draws: 0 };
    const A = map.get(m.away_class_id) ?? { classId: m.away_class_id, name: classMap.get(m.away_class_id) ?? '?', points: 0, wins: 0, losses: 0, draws: 0 };
    if (m.result === 'home_win') { H.points += win; H.wins += 1; A.points += loss; A.losses += 1; }
    else if (m.result === 'away_win') { H.points += loss; H.losses += 1; A.points += win; A.wins += 1; }
    else { H.points += draw; H.draws += 1; A.points += draw; A.draws += 1; }
    map.set(m.home_class_id, H);
    map.set(m.away_class_id, A);
  }

  const result = new Map<string, StandingRow[]>();
  for (const [g, map] of byGroup) {
    const rows = [...map.values()];
    rows.sort((a, b) => b.points - a.points || b.wins - a.wins || a.losses - b.losses);
    result.set(g, rows);
  }
  return result;
}
