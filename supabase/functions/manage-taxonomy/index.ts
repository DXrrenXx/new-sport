// manage-taxonomy: 管理年级与班级的增删改。登录管理员可操作，写日志。
// 删除年级/班级前检查是否被比赛引用，防止孤立数据。
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

    const { entity, action, payload } = await req.json();
    if (!['grade', 'class'].includes(entity)) return json({ error: { message: '无效 entity' } }, 400);
    const table = entity === 'grade' ? 'grades' : 'classes';

    if (action === 'create') {
      const row: any = entity === 'grade'
        ? { name: payload.name, display_order: payload.display_order ?? 0 }
        : { name: payload.name, grade_id: payload.grade_id };
      const { data, error } = await admin.from(table).insert(row).select().single();
      if (error) throw error;
      await admin.from('admin_logs').insert({ actor_email: user.email, action_type: `create_${entity}`, detail: row });
      return json({ data });
    }
    if (action === 'update') {
      const { data, error } = await admin.from(table).update(payload.fields).eq('id', payload.id).select().single();
      if (error) throw error;
      await admin.from('admin_logs').insert({ actor_email: user.email, action_type: `update_${entity}`, detail: payload });
      return json({ data });
    }
    if (action === 'delete') {
      // 引用检查
      if (entity === 'grade') {
        const { count } = await admin.from('classes').select('id', { count: 'exact', head: true }).eq('grade_id', payload.id);
        if (count && count > 0) throw new Error('该年级下还有班级，不能删除');
        const { count: mc } = await admin.from('matches').select('id', { count: 'exact', head: true }).eq('grade_id', payload.id);
        if (mc && mc > 0) throw new Error('该年级下还有比赛，不能删除');
      } else {
        const { count } = await admin.from('matches').select('id', { count: 'exact', head: true }).or(`home_class_id.eq.${payload.id},away_class_id.eq.${payload.id}`);
        if (count && count > 0) throw new Error('该班级下还有比赛，不能删除');
      }
      const { error } = await admin.from(table).delete().eq('id', payload.id);
      if (error) throw error;
      await admin.from('admin_logs').insert({ actor_email: user.email, action_type: `delete_${entity}`, detail: { id: payload.id } });
      return json({ data: { success: true } });
    }
    return json({ error: { message: '无效 action' } }, 400);
  } catch (error) {
    console.error('manage-taxonomy error:', error);
    return json({ error: { message: String((error as any)?.message ?? error) } }, 400);
  }
});
function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
