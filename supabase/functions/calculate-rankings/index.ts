// calculate-rankings: 重算指定年级（或全部年级）的排行榜。
// 计算逻辑统一由数据库函数 recalc_rankings 承担（只统计小组赛、跳过 TBD、与录分/删改自动重算同一份实现）。
// 本函数仅做登录校验与转发，供后台「重新计算」按钮使用。
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
    if (!user) {
      return new Response(JSON.stringify({ error: { message: '未授权：需要登录' } }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json().catch(() => ({}));
    const gradeId: number | undefined = body.gradeId ?? body.grade_id;

    const { error } = gradeId
      ? await admin.rpc('recalc_rankings', { p_grade_id: gradeId })
      : await admin.rpc('recalc_rankings', {});
    if (error) throw error;

    return new Response(JSON.stringify({ data: { success: true, message: 'Rankings recalculated' } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('calculate-rankings error:', error);
    return new Response(JSON.stringify({ error: { message: String((error as any)?.message ?? error) } }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
