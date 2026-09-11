// admin-settings: 读/写站点设置。
// action=get_public  -> 任人可读：返回 content（公告）+ footer（页脚），不含邀请码。
// action=get_admin   -> 登录管理员：返回 content + admin_guide + footer（不含邀请码）。
// action=get_super   -> 仅超管：额外返回 invite_code。
// action=set_content -> 登录管理员可改公告。
// action=set_guide / set_invite / set_footer -> 仅超管。
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
const isSuper = (u: any) => u?.app_metadata?.role === 'super_admin';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { action, value } = await req.json();

    if (action === 'get_public') {
      const { data } = await admin.from('site_settings').select('content, footer').eq('id', 1).single();
      return json({ data: { content: data?.content ?? '', footer: data?.footer ?? '' } });
    }

    const user = await getUser(req, supabaseUrl, anonKey);
    if (!user) return json({ error: { message: '未授权：需要登录' } }, 401);

    if (action === 'get_admin') {
      const { data } = await admin.from('site_settings').select('content, admin_guide, footer').eq('id', 1).single();
      return json({ data: { content: data?.content ?? '', admin_guide: data?.admin_guide ?? '', footer: data?.footer ?? '', isSuper: isSuper(user) } });
    }
    if (action === 'get_super') {
      if (!isSuper(user)) return json({ error: { message: '仅超管可操作' } }, 403);
      const { data } = await admin.from('site_settings').select('content, admin_guide, footer, invite_code').eq('id', 1).single();
      return json({ data });
    }
    if (action === 'set_content') {
      await admin.from('site_settings').update({ content: value, updated_at: new Date().toISOString() }).eq('id', 1);
      await admin.from('admin_logs').insert({ actor_email: user.email, action_type: 'set_announcement', detail: {} });
      return json({ data: { success: true } });
    }
    if (action === 'set_guide') {
      if (!isSuper(user)) return json({ error: { message: '仅超管可修改使用说明' } }, 403);
      await admin.from('site_settings').update({ admin_guide: value, updated_at: new Date().toISOString() }).eq('id', 1);
      await admin.from('admin_logs').insert({ actor_email: user.email, action_type: 'set_admin_guide', detail: {} });
      return json({ data: { success: true } });
    }
    if (action === 'set_footer') {
      if (!isSuper(user)) return json({ error: { message: '仅超管可修改页脚' } }, 403);
      await admin.from('site_settings').update({ footer: value, updated_at: new Date().toISOString() }).eq('id', 1);
      await admin.from('admin_logs').insert({ actor_email: user.email, action_type: 'set_footer', detail: {} });
      return json({ data: { success: true } });
    }
    if (action === 'set_invite') {
      if (!isSuper(user)) return json({ error: { message: '仅超管可修改邀请码' } }, 403);
      await admin.from('site_settings').update({ invite_code: value, updated_at: new Date().toISOString() }).eq('id', 1);
      await admin.from('admin_logs').insert({ actor_email: user.email, action_type: 'set_invite_code', detail: {} });
      return json({ data: { success: true } });
    }
    return json({ error: { message: '无效 action' } }, 400);
  } catch (error) {
    console.error('admin-settings error:', error);
    return json({ error: { message: String((error as any)?.message ?? error) } }, 400);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
