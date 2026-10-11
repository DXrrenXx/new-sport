// 每局比分「详情」：桌面鼠标悬停 / 手机点击，弹出悬浮框展示各局比分与本场净胜分。
// 悬浮框用 createPortal 渲染到 body（避免对阵树槽位 transform 改变 fixed 定位参照系、以及 overflow 裁剪），
// 并采用 position:fixed + getBoundingClientRect 定位。
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SetScore } from '../lib/types';

export function SetScoreDetail({ sets }: { sets: SetScore[] | null | undefined }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; below: boolean } | null>(null);
  const rootRef = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);

  // 打开时：点击本组件（含悬浮框）以外任意处 / 页面滚动 → 关闭
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('click', onDocClick);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('click', onDocClick);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  if (!sets || !sets.length) return null;

  function show() {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = r.top < 160; // 视口顶部空间不足时翻转到下方
    setPos({ top: below ? r.bottom + 8 : r.top - 8, left: r.left + r.width / 2, below });
    setOpen(true);
  }
  // 悬停移出时延迟关闭，允许鼠标移动到悬浮框上（两者之间有间隙）
  function scheduleHide() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(false), 150);
  }

  const pd = sets.reduce((acc, s) => acc + (Number(s.home) | 0) - (Number(s.away) | 0), 0);

  const popover = open && pos ? (
    <div
      ref={popRef}
      className={`fixed z-50 -translate-x-1/2 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs shadow-lg whitespace-nowrap ${pos.below ? '' : '-translate-y-full'}`}
      style={{ top: pos.top, left: pos.left }}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') show(); }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') scheduleHide(); }}
    >
      <div className="space-y-0.5">
        {sets.map((s, i) => (
          <div key={i} className="flex justify-between gap-4">
            <span className="opacity-70">第{i + 1}局</span>
            <span className="font-mono">{s.home} : {s.away}</span>
          </div>
        ))}
        <div className="border-t border-white/20 pt-1 mt-1 flex justify-between gap-4">
          <span className="opacity-70">本场净胜分</span>
          <span className="font-mono">{pd > 0 ? `+${pd}` : pd}</span>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <span ref={rootRef} className="relative inline-block align-middle">
      <button
        type="button"
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') show(); }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') scheduleHide(); }}
        onClick={() => (open ? setOpen(false) : show())}
        aria-label="查看每局比分"
        className="text-sm leading-none text-slate-400 hover:text-brand px-0.5 align-middle"
      >
        ⓘ
      </button>
      {popover && createPortal(popover, document.body)}
    </span>
  );
}
