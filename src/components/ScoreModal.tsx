// 录分弹窗（小组赛与淘汰赛共用）：填写双方比分 -> update-match-result -> 保存后回调刷新。
import { useState } from 'react';
import type { EnrichedMatch } from '../lib/types';
import { updateMatchResult } from '../lib/api';
import { Button } from './ui';

export function ScoreModal({
  match, knockout = false, onClose, onSaved, onError, onSuccess,
}: {
  match: EnrichedMatch;
  knockout?: boolean; // 淘汰赛：强制不允许平局，提示文案不同
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
  onSuccess: (m: string) => void;
}) {
  const [hs, setHs] = useState(match.home_score?.toString() ?? '');
  const [as, setAs] = useState(match.away_score?.toString() ?? '');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (hs === '' || as === '') return onError('请填写双方得分');
    if (knockout && Number(hs) === Number(as)) return onError('淘汰赛不允许平局');
    setBusy(true);
    try {
      await updateMatchResult(match.id, Number(hs), Number(as));
      onSuccess(knockout ? '比赛结果已保存' : '比赛结果已保存，排行榜已自动更新');
      onSaved();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-40" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-1">录入比分</h3>
        {knockout && <p className="text-xs text-slate-400 mb-4">淘汰赛不允许平局，双方得分不能相同</p>}
        <div className="flex items-center gap-3 justify-center">
          <div className="text-center">
            <div className="text-sm text-slate-500 mb-1">{match.home_class_name || '待定'}</div>
            <input type="number" min="0" value={hs} onChange={(e) => setHs(e.target.value)}
              className="w-20 border border-slate-300 rounded-lg px-3 py-2 text-center text-lg outline-none focus:border-brand" />
          </div>
          <span className="text-2xl text-slate-300 mt-5">:</span>
          <div className="text-center">
            <div className="text-sm text-slate-500 mb-1">{match.away_class_name || '待定'}</div>
            <input type="number" min="0" value={as} onChange={(e) => setAs(e.target.value)}
              className="w-20 border border-slate-300 rounded-lg px-3 py-2 text-center text-lg outline-none focus:border-brand" />
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <Button variant="secondary" className="flex-1" onClick={onClose}>取消</Button>
          <Button className="flex-1" onClick={save} disabled={busy}>保存</Button>
        </div>
      </div>
    </div>
  );
}
