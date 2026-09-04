// 统一的数据访问层。
// - 读取（年级/项目/班级/赛程/排行榜）：直接用 anon key 查表（这些表有公开读 RLS 策略）。
// - 写入 / 敏感操作：一律调用 Edge Function（函数内做登录与权限校验，用 service_role 写库）。
import { supabase } from './supabase';
import type {
  Grade, Sport, ClassRow, EnrichedMatch, SportRanking, TotalRanking, AdminLog,
} from './types';

// ---------- 调用 Edge Function 的通用封装 ----------
async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    // 尝试从函数返回体里读出更具体的中文错误
    let msg = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        const j = await ctx.json();
        if (j?.error?.message) {
          msg = j.error.message;
          if (Array.isArray(j.error.details)) msg += '：\n' + j.error.details.join('\n');
        }
      }
    } catch {
      /* 忽略解析失败，用原始 message */
    }
    throw new Error(msg);
  }
  if (data && (data as { error?: { message?: string } }).error) {
    const e = (data as { error: { message: string; details?: string[] } }).error;
    let msg = e.message;
    if (Array.isArray(e.details)) msg += '：\n' + e.details.join('\n');
    throw new Error(msg);
  }
  return (data as { data: T }).data;
}

// ---------- 公开读取 ----------
export async function fetchGrades(): Promise<Grade[]> {
  const { data, error } = await supabase.from('grades').select('*').order('display_order');
  if (error) throw error;
  return data as Grade[];
}

export async function fetchSports(): Promise<Sport[]> {
  const { data, error } = await supabase.from('sports').select('*').order('id');
  if (error) throw error;
  return data as Sport[];
}

export async function fetchClasses(gradeId?: number): Promise<ClassRow[]> {
  let q = supabase.from('classes').select('*').order('id');
  if (gradeId) q = q.eq('grade_id', gradeId);
  const { data, error } = await q;
  if (error) throw error;
  return data as ClassRow[];
}

// 拉取赛程并在前端富化名称（读取用公开策略，避免依赖 Edge Function）
export async function fetchMatches(params: {
  gradeId?: number; sportId?: number; week?: number;
}): Promise<EnrichedMatch[]> {
  let q = supabase.from('matches').select('*').order('week').order('created_at');
  if (params.gradeId) q = q.eq('grade_id', params.gradeId);
  if (params.sportId) q = q.eq('sport_id', params.sportId);
  if (params.week != null) q = q.eq('week', params.week);
  const { data, error } = await q;
  if (error) throw error;

  const [grades, sports, classes] = await Promise.all([fetchGrades(), fetchSports(), fetchClasses()]);
  const gMap = new Map(grades.map((g) => [g.id, g.name]));
  const sMap = new Map(sports.map((s) => [s.id, s.name]));
  const cMap = new Map(classes.map((c) => [c.id, c.name]));
  return (data as EnrichedMatch[]).map((m) => ({
    ...m,
    grade_name: gMap.get(m.grade_id) ?? '?',
    sport_name: sMap.get(m.sport_id) ?? '?',
    home_class_name: cMap.get(m.home_class_id) ?? '?',
    away_class_name: cMap.get(m.away_class_id) ?? '?',
  }));
}

// 某年级+项目下已存在的周次列表
export async function fetchWeeks(gradeId: number, sportId: number): Promise<number[]> {
  const { data, error } = await supabase
    .from('matches').select('week').eq('grade_id', gradeId).eq('sport_id', sportId);
  if (error) throw error;
  return [...new Set((data as { week: number }[]).map((r) => r.week))].sort((a, b) => a - b);
}

// 某年级下有比赛的项目 ID 列表（用于前台过滤项目下拉框）
export async function fetchSportIdsWithMatches(gradeId: number): Promise<number[]> {
  const { data, error } = await supabase
    .from('matches').select('sport_id').eq('grade_id', gradeId);
  if (error) throw error;
  return [...new Set((data as { sport_id: number }[]).map((r) => r.sport_id))];
}

export async function fetchSportRankings(gradeId: number, sportId: number): Promise<SportRanking[]> {
  const { data, error } = await supabase
    .from('sport_rankings').select('*').eq('grade_id', gradeId).eq('sport_id', sportId);
  if (error) throw error;
  return data as SportRanking[];
}

export async function fetchTotalRankings(gradeId: number): Promise<TotalRanking[]> {
  const { data, error } = await supabase
    .from('total_rankings').select('*').eq('grade_id', gradeId);
  if (error) throw error;
  return data as TotalRanking[];
}

export async function fetchPublicSettings(): Promise<{ content: string; footer: string }> {
  return invoke<{ content: string; footer: string }>('admin-settings', { action: 'get_public' });
}

// ---------- 写入 / 管理操作（走 Edge Function） ----------
export function updateMatchResult(matchId: number, homeScore: number, awayScore: number) {
  return invoke('update-match-result', { matchId, homeScore, awayScore });
}

export function createMatch(matchData: Record<string, unknown>) {
  return invoke('manage-matches', { action: 'create', matchData });
}
export function updateMatch(matchId: number, matchData: Record<string, unknown>) {
  return invoke('manage-matches', { action: 'update', matchId, matchData });
}
export function deleteMatch(matchId: number) {
  return invoke('manage-matches', { action: 'delete', matchId });
}

export function recalcRankings(gradeId?: number) {
  return invoke('calculate-rankings', gradeId ? { gradeId } : {});
}

// verify-invite / calculate-rankings 允许空 body

export function batchImport(matches: unknown[]) {
  return invoke<{ inserted: number }>('batch-import-matches', { matches });
}

// 设置：公告 / 使用说明 / 邀请码
export function getAdminSettings() {
  return invoke<{ content: string; admin_guide: string; footer: string; isSuper: boolean }>('admin-settings', { action: 'get_admin' });
}
export function getSuperSettings() {
  return invoke<{ content: string; admin_guide: string; footer: string; invite_code: string }>('admin-settings', { action: 'get_super' });
}
export function setAnnouncement(value: string) {
  return invoke('admin-settings', { action: 'set_content', value });
}
export function setAdminGuide(value: string) {
  return invoke('admin-settings', { action: 'set_guide', value });
}
export function setFooter(value: string) {
  return invoke('admin-settings', { action: 'set_footer', value });
}
export function setInviteCode(value: string) {
  return invoke('admin-settings', { action: 'set_invite', value });
}

// 项目积分规则
export function updateScoringRules(sportId: number, rules: Record<string, unknown>) {
  return invoke('sports-settings', { action: 'update_rules', sportId, rules });
}

// 新增体育项目（后端默认积分规则：胜3/平1/负0/允许平局）
export function createSport(name: string) {
  return invoke('sports-settings', { action: 'create', name });
}

// 删除体育项目（该项目下已有比赛时后端会拒绝）
export function deleteSport(sportId: number) {
  return invoke('sports-settings', { action: 'delete', sportId });
}

// 年级 / 班级管理
export function createTaxonomy(entity: 'grade' | 'class', payload: Record<string, unknown>) {
  return invoke('manage-taxonomy', { entity, action: 'create', payload });
}
export function updateTaxonomy(entity: 'grade' | 'class', payload: Record<string, unknown>) {
  return invoke('manage-taxonomy', { entity, action: 'update', payload });
}
export function deleteTaxonomy(entity: 'grade' | 'class', id: number) {
  return invoke('manage-taxonomy', { entity, action: 'delete', payload: { id } });
}

// 操作日志（仅超管）
export function fetchAdminLogs(filter: { actor?: string; actionType?: string } = {}) {
  return invoke<AdminLog[]>('admin-logs', filter);
}

// 注册邀请码校验（前端不接触真实邀请码）
export async function verifyInvite(code: string): Promise<boolean> {
  const d = await invoke<{ valid: boolean }>('verify-invite', { code });
  return d.valid;
}
