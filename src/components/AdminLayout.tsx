// 后台通用布局：顶部标题 + 导航（超管专属入口按需显示）+ 退出。
import type { ReactNode } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Button } from './ui';

const NAV = [
  { to: '/admin', label: '结果录入' },
  { to: '/admin/schedule', label: '赛程管理' },
  { to: '/admin/sports', label: '项目管理' },
  { to: '/admin/taxonomy', label: '年级班级' },
  { to: '/admin/guide', label: '使用说明' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, isSuperAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const nav = isSuperAdmin ? [...NAV, { to: '/admin/logs', label: '操作日志' }] : NAV;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-brand text-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h1 className="text-base sm:text-lg font-bold">体育赛事管理 · 后台</h1>
            <div className="flex items-center gap-3 text-sm">
              <span className="opacity-90 hidden sm:inline">
                {user?.email}
                {isSuperAdmin && <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-xs">超管</span>}
              </span>
              <Link to="/" className="opacity-90 hover:opacity-100 underline">查看前台</Link>
              <button onClick={async () => { await signOut(); navigate('/admin/login'); }} className="opacity-90 hover:opacity-100 underline">
                退出登录
              </button>
            </div>
          </div>
          <nav className="flex gap-1 mt-3 flex-wrap">
            {nav.map((n) => {
              const active = location.pathname === n.to;
              return (
                <Button
                  key={n.to}
                  variant="ghost"
                  onClick={() => navigate(n.to)}
                  className={active ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10'}
                >
                  {n.label}
                </Button>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
