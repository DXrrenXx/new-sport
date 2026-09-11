// admin-logs: 仅超管可读取操作日志，支持按操作人/类型筛选。
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const user = await getUser(req, supabaseUrl, anonKey);
    if (!user) return json({ error: { message: '未授权' } }, 401);
    if (user.app_metadata?.role !== 'super_admin') return json({ error: { message: '仅超管可查看日志' } }, 403);

    const { actor, actionType, limit } = await req.json().catch(() => ({}));
    const admin = createClient(supabaseUrl, serviceRoleKey);
    let q = admin.from('admin_logs').select('*').order('created_at', { ascending: false }).limit(Math.min(limit ?? 200, 500));
    if (actor) q = q.eq('actor_email', actor);
    if (actionType) q = q.eq('action_type', actionType);
    const { data, error } = await q;
    if (error) throw error;
    return json({ data });
  } catch (error) {
    console.error('admin-logs error:', error);
    return json({ error: { message: String((error as any)?.message ?? error) } }, 400);
  }
});
function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
