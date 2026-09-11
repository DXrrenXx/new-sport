// DEPRECATED 且不安全（旧版可执行任意 SQL）。已禁用。注册请走标准 Supabase Auth。
Deno.serve(() => new Response(JSON.stringify({ error: { message: '此函数已禁用' } }), { status: 410, headers: { 'Content-Type': 'application/json' } }));
