// manage-matches: 创建/更新/重置/删除比赛。支持小组赛(group)与淘汰赛(knockout/third)。
// 淘汰赛：允许 TBD（班级为空 + source 指向来源）；winner:/loser: 来源需真实存在；
// class_id 仅在未开打时可改（出线填充走 update）；改判保护（下游已打则拒绝）；
// reset 清比分回 pending（含清空每局 sets；下游已打则拒绝，并清除下游已联动填入的班级）；
// delete 检查是否被下游 source 引用。
// 详细计分项目（scoring_rules.detailed）禁止直接改比分（走 update-match-result 弹窗）。
// 排行榜计算统一调用数据库函数 recalc_rankings（只统计小组赛）。
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function getUser(req: Request, url: string, anonKey: string) {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;
  const client = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data, error } = await client.auth.getUser(token);
  if (error) return null;
  return data.user;
}

// 找到同年级下所有 source 指向本场的下游比赛（winner: 或 loser:）
async function getDownstream(admin: any, matchId: number, gradeId: number) {
  const { data: all } = await admin.from('matches').select('*').eq('grade_id', gradeId).in('stage', ['knockout', 'third']);
  const targets = [`winner:${matchId}`, `loser:${matchId}`];
  return (all ?? []).filter((m: any) => targets.includes(m.home_source) || targets.includes(m.away_source));
}

// 下游是否有任何一场已开打/已录分
function anyPlayed(downs: any[]) {
  return downs.some((d: any) => d.status !== 'pending' || d.home_score !== null || d.away_score !== null || d.result !== 'pending');
}

// 清除下游由本场联动填入的班级（仅当下游未开打）
async function clearDownstream(admin: any, matchId: number, gradeId: number) {
  const downs = await getDownstream(admin, matchId, gradeId);
  for (const d of downs) {
    if (d.status !== 'pending' || d.result !== 'pending') continue;
    const patch: any = {};
    if (d.home_source === `winner:${matchId}` || d.home_source === `loser:${matchId}`) patch.home_class_id = null;
    if (d.away_source === `winner:${matchId}` || d.away_source === `loser:${matchId}`) patch.away_class_id = null;
    if (Object.keys(patch).length) await admin.from('matches').update(patch).eq('id', d.id);
  }
}

// 校验 winner:/loser: 来源引用的比赛真实存在
async function validateRefs(admin: any, ...sources: (string | null | undefined)[]) {
  for (const src of sources) {
    const mm = /^(winner|loser):(\d+)$/.exec(String(src ?? ''));
    if (mm) {
      const { data: ref } = await admin.from('matches').select('id').eq('id', Number(mm[2])).maybeSingle();
      if (!ref) throw new Error(`来源引用的比赛不存在（id=${mm[2]}）`);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const user = await getUser(req, supabaseUrl, anonKey);
    if (!user) return new Response(JSON.stringify({ error: { message: '未授权：需要登录' } }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { action, matchData, matchId } = await req.json();
    const admin = createClient(supabaseUrl, serviceRoleKey);
    let result: any;
    let affectedGrade: number | undefined;

    if (action === 'create') {
      if (!matchData) throw new Error('缺少比赛数据');
      const stage = matchData.stage || 'group';
      if (stage === 'group') {
        if (!matchData.home_class_id || !matchData.away_class_id) throw new Error('小组赛必须指定主队和客队');
        if (matchData.home_class_id === matchData.away_class_id) throw new Error('主队和客队不能是同一个班');
        // 防重：同年级/项目/周次/两队的小组赛已存在则拒绝（仅限小组赛，避免误挡淘汰赛填班）
        const { data: dup } = await admin.from('matches').select('id')
          .eq('grade_id', matchData.grade_id).eq('sport_id', matchData.sport_id).eq('week', matchData.week).eq('stage', 'group')
          .or(`and(home_class_id.eq.${matchData.home_class_id},away_class_id.eq.${matchData.away_class_id}),and(home_class_id.eq.${matchData.away_class_id},away_class_id.eq.${matchData.home_class_id})`);
        if (dup && dup.length) throw new Error('该周次已存在这两个班的同项目比赛');
      } else {
        // 淘汰赛/三四名：每个位置需班级或来源至少一者；来源引用需存在；两位置来源不能相同
        if (!matchData.home_class_id && !matchData.home_source) throw new Error('主队位置需要班级或来源');
        if (!matchData.away_class_id && !matchData.away_source) throw new Error('客队位置需要班级或来源');
        if (matchData.home_source && matchData.away_source && matchData.home_source === matchData.away_source) {
          throw new Error('主客队来源不能相同');
        }
        await validateRefs(admin, matchData.home_source, matchData.away_source);
      }
      const { data, error } = await admin.from('matches').insert({
        grade_id: matchData.grade_id, sport_id: matchData.sport_id, week: matchData.week,
        stage, round: matchData.round ?? null, group_label: matchData.group_label ?? null,
        home_class_id: matchData.home_class_id ?? null, away_class_id: matchData.away_class_id ?? null,
        home_source: matchData.home_source ?? null, away_source: matchData.away_source ?? null,
        status: matchData.status || 'pending', home_score: null, away_score: null, result: 'pending',
      }).select().single();
      if (error) throw error;
      result = data; affectedGrade = data.grade_id;
    } else if (action === 'update') {
      if (!matchId) throw new Error('缺少 matchId');
      const { data: existing } = await admin.from('matches').select('*').eq('id', matchId).maybeSingle();
      if (!existing) throw new Error('比赛不存在');
      const patch: any = {};
      if (matchData.week !== undefined) patch.week = matchData.week;
      if (matchData.status !== undefined) patch.status = matchData.status;
      if (matchData.round !== undefined) patch.round = matchData.round;
      if (matchData.group_label !== undefined) patch.group_label = matchData.group_label;
      if (matchData.home_source !== undefined) patch.home_source = matchData.home_source;
      if (matchData.away_source !== undefined) patch.away_source = matchData.away_source;
      // 淘汰赛比分只能通过 update-match-result 录入（保证晋级联动）
      if (existing.stage !== 'group' && (matchData.home_score !== undefined || matchData.away_score !== undefined)) {
        throw new Error('淘汰赛比分请在淘汰赛管理页通过「录入」保存');
      }
      // 小组赛改分：详细计分项目禁止直改（避免与每局数据脱节）；普通项目自动重算 result
      if (existing.stage === 'group' && (matchData.home_score !== undefined || matchData.away_score !== undefined)) {
        const { data: sport } = await admin.from('sports').select('name, scoring_rules').eq('id', existing.sport_id).maybeSingle();
        if (sport?.scoring_rules?.detailed) {
          throw new Error('该项目已开启详细计分，请在「结果录入」弹窗中填写比分或每局比分');
        }
        if (matchData.home_score !== undefined && matchData.away_score !== undefined) {
          patch.home_score = matchData.home_score;
          patch.away_score = matchData.away_score;
          if (patch.home_score == null || patch.away_score == null) {
            patch.result = 'pending'; patch.status = 'pending';
          } else {
            const nh = Number(patch.home_score), na = Number(patch.away_score);
            if (nh === na) {
              if (!sport?.scoring_rules?.allow_draw) throw new Error(`${sport?.name ?? '该项目'} 不允许平局，比分不能相等`);
              patch.result = 'draw';
            } else {
              patch.result = nh > na ? 'home_win' : 'away_win';
            }
            patch.status = 'completed';
          }
        }
      }
      // 来源引用校验（与 create 一致）
      if (matchData.home_source !== undefined || matchData.away_source !== undefined) {
        await validateRefs(admin, matchData.home_source ?? existing.home_source, matchData.away_source ?? existing.away_source);
      }
      // 参赛班级变更：仅未开打时可改；淘汰赛改判保护
      const clsChanged = (matchData.home_class_id !== undefined && matchData.home_class_id !== existing.home_class_id)
        || (matchData.away_class_id !== undefined && matchData.away_class_id !== existing.away_class_id);
      if (clsChanged) {
        if (existing.status !== 'pending' || existing.result !== 'pending' || existing.home_score !== null || existing.away_score !== null) {
          throw new Error('该比赛已开始或已录分，不能修改参赛班级');
        }
        if (existing.stage !== 'group') {
          const newHome = matchData.home_class_id !== undefined ? matchData.home_class_id : existing.home_class_id;
          const newAway = matchData.away_class_id !== undefined ? matchData.away_class_id : existing.away_class_id;
          const changed = (existing.home_class_id !== null && newHome !== existing.home_class_id)
            || (existing.away_class_id !== null && newAway !== existing.away_class_id);
          if (changed) {
            const downs = await getDownstream(admin, matchId, existing.grade_id);
            if (anyPlayed(downs)) throw new Error('下一轮比赛已开打，不能更换参赛班级。如确需调整，请先重置下一轮比赛');
          }
        }
        patch.home_class_id = matchData.home_class_id ?? null;
        patch.away_class_id = matchData.away_class_id ?? null;
      }
      patch.updated_at = new Date().toISOString();
      const { data, error } = await admin.from('matches').update(patch).eq('id', matchId).select().single();
      if (error) throw error;
      result = data; affectedGrade = data.grade_id;
    } else if (action === 'reset') {
      if (!matchId) throw new Error('缺少 matchId');
      const { data: existing } = await admin.from('matches').select('*').eq('id', matchId).maybeSingle();
      if (!existing) throw new Error('比赛不存在');
      if (existing.stage !== 'group') {
        const downs = await getDownstream(admin, matchId, existing.grade_id);
        if (anyPlayed(downs)) throw new Error('下一轮比赛已开打，不能重置本场比赛。请先重置下一轮比赛');
      }
      await admin.from('matches').update({
        home_score: null, away_score: null, sets: null, result: 'pending', status: 'pending', updated_at: new Date().toISOString(),
      }).eq('id', matchId);
      // 下游未开打（前置条件已保证），清除其由本场联动填入的班级
      await clearDownstream(admin, matchId, existing.grade_id);
      result = { success: true }; affectedGrade = existing.grade_id;
    } else if (action === 'delete') {
      if (!matchId) throw new Error('缺少 matchId');
      const { data: existing } = await admin.from('matches').select('grade_id').eq('id', matchId).maybeSingle();
      if (!existing) throw new Error('比赛不存在');
      const downs = await getDownstream(admin, matchId, existing.grade_id);
      if (downs.length) throw new Error('该比赛是其他比赛的队伍来源，无法删除。请先删除引用它的比赛');
      const { error } = await admin.from('matches').delete().eq('id', matchId);
      if (error) throw error;
      result = { success: true }; affectedGrade = existing?.grade_id;
    } else {
      throw new Error('无效 action（应为 create/update/reset/delete）');
    }

    // 排行榜重算：统一由数据库函数承担（只统计小组赛 + 跳过 TBD）
    if (affectedGrade) {
      const { error: rErr } = await admin.rpc('recalc_rankings', { p_grade_id: affectedGrade });
      if (rErr) throw rErr;
    }

    await admin.from('admin_logs').insert({
      actor_email: user.email,
      action_type: `match_${action}`,
      detail: { matchId: matchId ?? result?.id, matchData: matchData ?? null },
    });

    return new Response(JSON.stringify({ data: result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('manage-matches error:', error);
    return new Response(JSON.stringify({ error: { message: String((error as any)?.message ?? error) } }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
