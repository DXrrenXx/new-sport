// DEPRECATED: 已被 batch-import-matches 取代。
Deno.serve(() => new Response(JSON.stringify({ error: { message: '此函数已废弃，请使用 batch-import-matches' } }), { status: 410, headers: { 'Content-Type': 'application/json' } }));
