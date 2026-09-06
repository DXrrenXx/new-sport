// 通用小组件：按钮、加载态、结果/状态标签、消息提示。
import type { ReactNode } from 'react';
import type { MatchResult, MatchStatus, MatchStage } from '../lib/types';

export function Button({
  children, onClick, variant = 'primary', disabled, type = 'button', className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  const base = 'px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed';
  const styles: Record<string, string> = {
    primary: 'bg-brand text-white hover:bg-brand-dark',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-slate-600 hover:bg-slate-100',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function Spinner({ label = '加载中…' }: { label?: string }) {
  return <div className="py-8 text-center text-slate-400 text-sm">{label}</div>;
}

export function StatusBadge({ status }: { status: MatchStatus }) {
  const map: Record<MatchStatus, [string, string]> = {
    pending: ['未开始', 'bg-amber-100 text-amber-700'],
    in_progress: ['进行中', 'bg-blue-100 text-blue-700'],
    completed: ['已结束', 'bg-emerald-100 text-emerald-700'],
  };
  const [text, cls] = map[status];
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{text}</span>;
}

// 阶段徽章：小组赛不显示，淘汰赛/三四名显示
export function StageBadge({ stage }: { stage: MatchStage }) {
  if (stage === 'group') return null;
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${stage === 'third' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}`}>
      {stage === 'third' ? '三四名' : '淘汰赛'}
    </span>
  );
}

export function ResultText({
  result, homeName, awayName,
}: { result: MatchResult; homeName: string; awayName: string }) {
  if (result === 'home_win') return <span className="font-medium text-emerald-700">{homeName}胜</span>;
  if (result === 'away_win') return <span className="font-medium text-emerald-700">{awayName}胜</span>;
  if (result === 'draw') return <span className="font-medium text-slate-600">平局</span>;
  return <span className="text-slate-400">—</span>;
}

export function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  if (!msg) return null;
  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-lg shadow-lg text-sm whitespace-pre-line max-w-md ${
        type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
      }`}
    >
      {msg}
    </div>
  );
}
