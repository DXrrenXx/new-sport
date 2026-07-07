import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // 提前给出清晰报错，避免部署时忘了配环境变量却难以排查
  throw new Error(
    '缺少 Supabase 环境变量。请在 .env（本地）或 Cloudflare Pages 环境变量中设置 ' +
      'VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY。',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export { supabaseUrl };
