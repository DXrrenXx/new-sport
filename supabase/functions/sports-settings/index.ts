// sports-settings: 管理体育项目及其计分规则 {win,draw,loss,allow_draw}。
// action=update_rules -> 登录管理员可改；action=create -> 新增项目；action=delete -> 删除项目（有比赛引用时拒绝）。
// 改规则/删除后重算全部年级排行榜（数据库函数 recalc_rankings，只统计小组赛）。
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
    const { action, sportId, rules, name } = await req.json();

    const user = await getUser(req, supabaseUrl, anonKey);
    if (!user) return json({ error: { message: '未授权' } }, 401);

    if (action === 'update_rules') {
      const clean = {
        win: Number(rules.win) || 0,
        draw: Number(rules.draw) || 0,
        loss: Number(rules.loss) || 0,
        allow_draw: !!rules.allow_draw,
      };
      await admin.from('sports').update({ scoring_rules: clean }).eq('id', sportId);
      // 规则变了，重算所有年级（数据库函数）
      const { error: rErr } = await admin.rpc('recalc_rankings', {});
      if (rErr) throw rErr;
      await admin.from('admin_logs').insert({ actor_email: user.email, action_type: 'update_scoring_rules', detail: { sportId, rules: clean } });
      return json({ data: { success: true } });
    }
    if (action === 'create') {
      const { data, error } = await admin.from('sports').insert({ name, scoring_rules: rules ?? { win: 3, draw: 1, loss: 0, allow_draw: true } }).select().single();
      if (error) throw error;
      await admin.from('admin_logs').insert({ actor_email: user.email, action_type: 'create_sport', detail: { name } });
      return json({ data });
    }
    if (action === 'delete') {
      // 被比赛引用的项目不允许删除，防止数据悬挂
      const { data: used } = await admin.from('matches').select('id').eq('sport_id', sportId).limit(1);
      if (used && used.length > 0) {
        return json({ error: { message: '该项目下已有比赛，无法删除。请先在赛程管理中删除相关比赛。' } }, 400);
      }
      await admin.from('sport_rankings').delete().eq('sport_id', sportId);
      const { error } = await admin.from('sports').delete().eq('id', sportId);
      if (error) throw error;
      // 清理该项目排名残留后，重算所有年级（数据库函数）
      const { error: rErr } = await admin.rpc('recalc_rankings', {});
      if (rErr) throw rErr;
      await admin.from('admin_logs').insert({ actor_email: user.email, action_type: 'delete_sport', detail: { sportId } });
      return json({ data: { success: true } });
    }
    return json({ error: { message: '无效 action' } }, 400);
  } catch (error) {
    console.error('sports-settings error:', error);
    return json({ error: { message: String((error as any)?.message ?? error) } }, 400);
  }
});
function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
