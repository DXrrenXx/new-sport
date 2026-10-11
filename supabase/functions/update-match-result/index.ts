// update-match-result: 录入比分 -> 判定 result -> 晋级联动（淘汰赛）-> 重算该年级小组赛排行榜。
// 淘汰赛强制无平局；TBD（班级未定）不可录分；改判保护（下游已打则拒绝换胜者）。
// 详细计分（scoring_rules.detailed）：可选传 sets（每局比分），局分与胜负由 sets 推导；
// sets 未传=不动；sets 为 null/空数组=显式清空（保持与局分一致）。
// 排行榜计算统一调用数据库函数 recalc_rankings。
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

async function getDownstream(admin: any, matchId: number, gradeId: number) {
  const { data: all } = await admin.from('matches').select('*').eq('grade_id', gradeId).in('stage', ['knockout', 'third']);
  const targets = [`winner:${matchId}`, `loser:${matchId}`];
  return (all ?? []).filter((m: any) => targets.includes(m.home_source) || targets.includes(m.away_source));
}

// 校验并清洗每局比分（三局两胜）：返回 { clean, hw, aw }
function validateSets(sets: any[]): { clean: { home: number; away: number }[]; hw: number; aw: number } {
  if (!Array.isArray(sets) || (sets.length !== 2 && sets.length !== 3)) {
    throw new Error('每局比分需要填写 2 局或 3 局');
  }
  let hw = 0, aw = 0;
  const clean: { home: number; away: number }[] = [];
  for (const s of sets) {
    const h = Number(s?.home), a = Number(s?.away);
    if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0) throw new Error('每局比分必须是非负整数');
    if (h === a) throw new Error('每局比分不能相同');
    if (h > a) hw++; else aw++;
    clean.push({ home: h, away: a });
  }
  const ok = sets.length === 2 ? (hw === 2 || aw === 2) : ((hw === 2 && aw === 1) || (hw === 1 && aw === 2));
  if (!ok) throw new Error(sets.length === 2 ? '只填 2 局时必须是 2:0（一方连胜两局）' : '填写 3 局时局分必须是 2:1');
  return { clean, hw, aw };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const user = await getUser(req, supabaseUrl, anonKey);
    if (!user) {
      return new Response(JSON.stringify({ error: { message: '未授权：需要登录' } }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { matchId, homeScore, awayScore, sets } = await req.json();
    if (!matchId) throw new Error('matchId 为必填');
    const setsProvided = sets !== undefined;
    if (!setsProvided && (homeScore === undefined || awayScore === undefined)) {
      throw new Error('比分或每局比分为必填');
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: match, error: mErr } = await admin.from('matches').select('*').eq('id', matchId).single();
    if (mErr || !match) throw new Error('比赛不存在');

    const { data: sport, error: sErr } = await admin.from('sports').select('*').eq('id', match.sport_id).single();
    if (sErr || !sport) throw new Error('项目不存在');

    // 每局比分处理：未传=不动；null/空数组=清空；有值则校验并推导局分
    let newSets: { home: number; away: number }[] | null | undefined = undefined;
    let hs: number, as: number;
    if (!setsProvided) {
      hs = Number(homeScore); as = Number(awayScore);
      if (!Number.isInteger(hs) || !Number.isInteger(as) || hs < 0 || as < 0) throw new Error('比分必须是非负整数');
    } else if (sets === null || (Array.isArray(sets) && sets.length === 0)) {
      newSets = null;
      hs = Number(homeScore); as = Number(awayScore);
      if (!Number.isInteger(hs) || !Number.isInteger(as) || hs < 0 || as < 0) throw new Error('比分必须是非负整数');
    } else {
      if (!sport.scoring_rules?.detailed) throw new Error('该项目未开启详细计分，不能填写每局比分');
      const v = validateSets(sets);
      newSets = v.clean;
      hs = v.hw; as = v.aw; // 局分由每局结果推导
    }

    // TBD：参赛班级未确定时不可录分
    if (match.home_class_id == null || match.away_class_id == null) {
      throw new Error('参赛队伍尚未确定，无法录入比分');
    }

    // 淘汰赛强制无平局（不受项目 allow_draw 影响）
    if (match.stage !== 'group' && hs === as) {
      throw new Error('淘汰赛不允许平局，比分不能相等');
    }

    let result: string;
    if (hs > as) result = 'home_win';
    else if (hs < as) result = 'away_win';
    else {
      if (!sport.scoring_rules?.allow_draw) throw new Error(`${sport.name} 不允许平局，比分不能相等`);
      result = 'draw';
    }

    // 改判保护：淘汰赛换胜者且下游已开打 -> 拒绝（上游已录分过的场景）
    if (match.stage !== 'group' && match.result !== 'pending') {
      const oldWinner = match.result === 'home_win' ? match.home_class_id : (match.result === 'away_win' ? match.away_class_id : null);
      const newWinner = result === 'home_win' ? match.home_class_id : match.away_class_id;
      if (newWinner !== oldWinner) {
        const downs = await getDownstream(admin, matchId, match.grade_id);
        const played = downs.some((d: any) => d.status !== 'pending' || d.home_score !== null || d.away_score !== null || d.result !== 'pending');
        if (played) throw new Error('下一轮比赛已开打，不能改判。如确需修改，请先重置下一轮比赛');
      }
    }

    const patch: any = {
      home_score: hs, away_score: as, result, status: 'completed', updated_at: new Date().toISOString(),
    };
    if (newSets !== undefined) patch.sets = newSets;
    const { error: upErr } = await admin.from('matches').update(patch).eq('id', matchId);
    if (upErr) throw upErr;

    // 晋级联动：把胜者/负者填入下游。
    // 下游已开打且新值≠现值 -> 拒绝；值相同 -> 幂等跳过。
    if (match.stage !== 'group' && result !== 'draw') {
      const winnerId = result === 'home_win' ? match.home_class_id : match.away_class_id;
      const loserId = result === 'home_win' ? match.away_class_id : match.home_class_id;
      const downs = await getDownstream(admin, matchId, match.grade_id);
      for (const d of downs) {
        const played = d.status !== 'pending' || d.home_score !== null || d.away_score !== null || d.result !== 'pending';
        const p: any = {};
        const fill = (side: 'home' | 'away', want: 'winner' | 'loser') => {
          const srcKey = side === 'home' ? 'home_source' : 'away_source';
          const clsKey = side === 'home' ? 'home_class_id' : 'away_class_id';
          if (d[srcKey] !== `${want}:${matchId}`) return;
          const val = want === 'winner' ? winnerId : loserId;
          if (d[clsKey] === val) return; // 幂等：值相同跳过
          if (played) throw new Error('下一轮比赛已开打，不能改判。如确需修改，请先重置下一轮比赛');
          p[clsKey] = val;
        };
        fill('home', 'winner'); fill('home', 'loser'); fill('away', 'winner'); fill('away', 'loser');
        if (Object.keys(p).length) {
          const { error: dErr } = await admin.from('matches').update(p).eq('id', d.id);
          if (dErr) throw dErr;
        }
      }
    }

    // 重算该年级小组赛排行榜：统一由数据库函数承担
    const { error: rErr } = await admin.rpc('recalc_rankings', { p_grade_id: match.grade_id });
    if (rErr) throw rErr;

    await admin.from('admin_logs').insert({
      actor_email: user.email,
      action_type: 'update_match_result',
      detail: { matchId, stage: match.stage, homeScore: hs, awayScore: as, result },
    });

    return new Response(JSON.stringify({ data: { success: true, result } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('update-match-result error:', error);
    return new Response(JSON.stringify({ error: { message: String((error as any)?.message ?? error) } }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
