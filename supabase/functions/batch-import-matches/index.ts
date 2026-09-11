// batch-import-matches: 批量导入小组赛。接收友好格式（中文名称），自动转 ID，校验，自动重算，写日志。
// 输入每项：{ grade, sport, week, homeClass, awayClass, group?, score?, status? }
// group 为可选小组标签（如 'A'）；score 形如 "20:18"；留空或 status!=completed 则视为未开始。
// 排行榜计算统一调用数据库函数 recalc_rankings（按受影响年级逐个重算）。
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
  return error ? null : data.user;
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const user = await getUser(req, supabaseUrl, anonKey);
    if (!user) return json({ error: { message: '未授权' } }, 401);

    const { matches } = await req.json();
    if (!Array.isArray(matches) || !matches.length) throw new Error('matches 不能为空');

    const [{ data: grades }, { data: sports }, { data: classes }] = await Promise.all([
      admin.from('grades').select('id, name'),
      admin.from('sports').select('id, name, scoring_rules'),
      admin.from('classes').select('id, name, grade_id'),
    ]);
    const gradeByName = new Map(grades!.map((g: any) => [g.name, g.id]));
    const sportByName = new Map(sports!.map((s: any) => [s.name, s]));
    const classByGradeName = new Map(classes!.map((c: any) => [`${c.grade_id}-${c.name}`, c.id]));

    const rows: any[] = [];
    const errors: string[] = [];
    const gradesTouched = new Set<number>();
    matches.forEach((m: any, i: number) => {
      const gid = gradeByName.get(m.grade);
      const sport = sportByName.get(m.sport);
      if (!gid) { errors.push(`第${i + 1}行：年级“${m.grade}”不存在`); return; }
      if (!sport) { errors.push(`第${i + 1}行：项目“${m.sport}”不存在`); return; }
      const hid = classByGradeName.get(`${gid}-${m.homeClass}`);
      const aid = classByGradeName.get(`${gid}-${m.awayClass}`);
      if (!hid) { errors.push(`第${i + 1}行：班级“${m.homeClass}”不存在于${m.grade}`); return; }
      if (!aid) { errors.push(`第${i + 1}行：班级“${m.awayClass}”不存在于${m.grade}`); return; }
      if (hid === aid) { errors.push(`第${i + 1}行：主客队不能相同`); return; }

      let home_score = null, away_score = null, result = 'pending', status = 'pending';
      if (m.status === 'completed' && m.score) {
        const mm = String(m.score).match(/(\d+)\s*[:：]\s*(\d+)/);
        if (!mm) { errors.push(`第${i + 1}行：比分格式错误“${m.score}”`); return; }
        home_score = parseInt(mm[1]); away_score = parseInt(mm[2]);
        if (home_score > away_score) result = 'home_win';
        else if (home_score < away_score) result = 'away_win';
        else {
          if (!sport.scoring_rules?.allow_draw) { errors.push(`第${i + 1}行：${m.sport}不允许平局`); return; }
          result = 'draw';
        }
        status = 'completed';
      }
      const groupLabel = m.group != null && String(m.group).trim() !== '' ? String(m.group).trim() : null;
      rows.push({ grade_id: gid, sport_id: sport.id, week: m.week, stage: 'group', group_label: groupLabel, home_class_id: hid, away_class_id: aid, home_score, away_score, result, status });
      gradesTouched.add(gid);
    });

    if (errors.length) return json({ error: { message: '导入校验失败', details: errors } }, 400);

    const { data: inserted, error } = await admin.from('matches').insert(rows).select();
    if (error) throw error;

    // 按受影响年级逐个重算（数据库函数）
    for (const gid of gradesTouched) {
      const { error: rErr } = await admin.rpc('recalc_rankings', { p_grade_id: gid });
      if (rErr) throw rErr;
    }
    await admin.from('admin_logs').insert({ actor_email: user.email, action_type: 'batch_import', detail: { count: inserted!.length } });

    return json({ data: { success: true, inserted: inserted!.length } });
  } catch (error) {
    console.error('batch-import error:', error);
    return json({ error: { message: String((error as any)?.message ?? error) } }, 400);
  }
});
function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
