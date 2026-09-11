// verify-invite: 注册前校验邀请码。前端不接触真实邀请码，仅提交待验证的值。
// 公开调用（verify_jwt=false），因为注册时用户还未登录。
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { code } = await req.json();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data } = await admin.from('site_settings').select('invite_code').eq('id', 1).single();
    const ok = !!code && code === data?.invite_code;
    return new Response(JSON.stringify({ data: { valid: ok } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: { message: String((error as any)?.message ?? error) } }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
