// 淘汰赛管理子组件：生成骨架表单（首轮场数 / 首轮周次 / 是否含三四名）。
import { useState } from 'react';
import { Button } from './ui';

export function KnockoutSkeletonCard({
  busy, onGenerate,
}: {
  busy: boolean;
  onGenerate: (opts: { firstRound: number; startWeek: number; includeThird: boolean }) => void;
}) {
  const [firstRound, setFirstRound] = useState(2);
  const [startWeek, setStartWeek] = useState(6);
  const [includeThird, setIncludeThird] = useState(true);

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4">
      <h2 className="font-semibold mb-1">生成淘汰赛</h2>
      <p className="text-sm text-slate-500 mb-3">
        选择首轮场数后自动生成全部轮次：每轮减半，最后一轮为决赛；首轮对阵自动标注各组出线来源（8 场及以上需手动填写）。
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-500">首轮场数</span>
          <select value={firstRound} onChange={(e) => setFirstRound(Number(e.target.value))}
            className="border border-slate-300 rounded-lg px-3 py-2 bg-white outline-none focus:border-brand">
            {[1, 2, 4, 8, 16].map((n) => (
              <option key={n} value={n}>{n} 场（{n * 2} 队{n === 1 ? '，直接决赛' : ''}）</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-500">首轮周次（后续轮次自动递增）</span>
          <input type="number" min="1" value={startWeek} onChange={(e) => setStartWeek(Number(e.target.value))}
            className="w-24 border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-brand" />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600 mb-2">
          <input type="checkbox" checked={includeThird} disabled={firstRound < 2}
            onChange={(e) => setIncludeThird(e.target.checked)} />
          包含三四名决赛
        </label>
        <Button onClick={() => onGenerate({ firstRound, startWeek, includeThird })} disabled={busy}>
          {busy ? '生成中…' : '生成淘汰赛'}
        </Button>
      </div>
    </div>
  );
}
