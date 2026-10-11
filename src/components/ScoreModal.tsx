// 录分弹窗（小组赛与淘汰赛共用）：填写比分 -> update-match-result -> 保存后回调刷新。
// detailed=true（详细计分项目）：可额外填写每局比分（选填）；填完整后局分自动推导并锁定输入。
import { useState } from 'react';
import type { EnrichedMatch, SetScore } from '../lib/types';
import { updateMatchResult } from '../lib/api';
import { Button } from './ui';

interface SetInput { home: string; away: string }

// 解析每局输入：null=未填写；{error}=不合法；否则返回清洗后的 sets 与推导局分
function deriveSets(rows: SetInput[]): { clean: SetScore[]; hw: number; aw: number } | { error: string } | null {
  const hasAny = rows.some((r) => r.home !== '' || r.away !== '');
  if (!hasAny) return null;
  const clean: SetScore[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if ((r.home !== '') !== (r.away !== '')) return { error: '每局比分请成对填写' };
    if (r.home === '' && r.away === '') {
      for (let j = i + 1; j < rows.length; j++) {
        if (rows[j].home !== '' || rows[j].away !== '') return { error: '每局比分请按顺序填写' };
      }
      break;
    }
    const h = Number(r.home), a = Number(r.away);
    if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0) return { error: '每局比分必须是非负整数' };
    if (h === a) return { error: '每局比分不能相同' };
    clean.push({ home: h, away: a });
  }
  if (clean.length < 2) return { error: '至少填写 2 局（2:0 或 2:1）' };
  let hw = 0, aw = 0;
  for (const s of clean) { if (s.home > s.away) hw++; else aw++; }
  const ok = clean.length === 2 ? (hw === 2 || aw === 2) : ((hw === 2 && aw === 1) || (hw === 1 && aw === 2));
  if (!ok) return { error: clean.length === 2 ? '只填 2 局时必须是 2:0（一方连胜两局）' : '填写 3 局时局分必须是 2:1' };
  return { clean, hw, aw };
}

export function ScoreModal({
  match, knockout = false, detailed = false, onClose, onSaved, onError, onSuccess,
}: {
  match: EnrichedMatch;
  knockout?: boolean; // 淘汰赛：强制不允许平局，提示文案不同
  detailed?: boolean; // 详细计分：展示每局比分输入
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
  onSuccess: (m: string) => void;
}) {
  const [hs, setHs] = useState(match.home_score?.toString() ?? '');
  const [as, setAs] = useState(match.away_score?.toString() ?? '');
  const [setRows, setSetRows] = useState<SetInput[]>(() => {
    // 预填已有每局数据；始终补齐为 3 行（2:0 的比赛可以补录第三局改判为 2:1）
    const rows: SetInput[] = (match.sets ?? []).map((s) => ({ home: String(s.home), away: String(s.away) }));
    while (rows.length < 3) rows.push({ home: '', away: '' });
    return rows;
  });
  const [busy, setBusy] = useState(false);

  const derived = detailed ? deriveSets(setRows) : null;
  const derivedOk = derived && !('error' in derived) ? derived : null;
  const derivedErr = derived && 'error' in derived ? derived.error : '';

  function patchSet(i: number, key: 'home' | 'away', v: string) {
    setSetRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)));
  }

  async function save() {
    if (derivedErr) return onError(derivedErr);
    const useHs = derivedOk ? derivedOk.hw : Number(hs);
    const useAs = derivedOk ? derivedOk.aw : Number(as);
    if (!derivedOk && (hs === '' || as === '')) return onError('请填写双方得分');
    if (knockout && useHs === useAs) return onError('淘汰赛不允许平局');
    // 已有每局数据被清空时给出确认，避免误操作丢失净胜分数据
    if (detailed && !derivedOk && match.sets && match.sets.length > 0) {
      if (!confirm('本次保存将清空该场已记录的每局比分（该场净胜分归零），确定继续吗？')) return;
    }
    // detailed 且未填每局 → 传 null 清空（避免与旧每局数据不一致）；非 detailed → 不传该字段
    const setsPayload: SetScore[] | null | undefined = detailed ? (derivedOk ? derivedOk.clean : null) : undefined;
    setBusy(true);
    try {
      await updateMatchResult(match.id, useHs, useAs, setsPayload);
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
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-1">录入比分</h3>
        {knockout && <p className="text-xs text-slate-400 mb-2">淘汰赛不允许平局，双方得分不能相同</p>}
        <div className="flex items-center gap-3 justify-center mt-3">
          <div className="text-center">
            <div className="text-sm text-slate-500 mb-1">{match.home_class_name || '待定'}</div>
            <input type="number" min="0" value={derivedOk ? String(derivedOk.hw) : hs} disabled={!!derivedOk}
              onChange={(e) => setHs(e.target.value)}
              className="w-20 border border-slate-300 rounded-lg px-3 py-2 text-center text-lg outline-none focus:border-brand disabled:bg-slate-100 disabled:text-slate-500" />
          </div>
          <span className="text-2xl text-slate-300 mt-5">:</span>
          <div className="text-center">
            <div className="text-sm text-slate-500 mb-1">{match.away_class_name || '待定'}</div>
            <input type="number" min="0" value={derivedOk ? String(derivedOk.aw) : as} disabled={!!derivedOk}
              onChange={(e) => setAs(e.target.value)}
              className="w-20 border border-slate-300 rounded-lg px-3 py-2 text-center text-lg outline-none focus:border-brand disabled:bg-slate-100 disabled:text-slate-500" />
          </div>
        </div>

        {detailed && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="text-sm text-slate-600 mb-2">每局比分<span className="text-slate-400">（选填）</span></div>
            <div className="space-y-2">
              {setRows.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-12 text-slate-500">第{i + 1}局</span>
                  <input type="number" min="0" value={r.home} onChange={(e) => patchSet(i, 'home', e.target.value)}
                    className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-center outline-none focus:border-brand" />
                  <span className="text-slate-300">:</span>
                  <input type="number" min="0" value={r.away} onChange={(e) => patchSet(i, 'away', e.target.value)}
                    className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-center outline-none focus:border-brand" />
                </div>
              ))}
            </div>
            {derivedOk && <p className="text-xs text-emerald-600 mt-2">已根据每局比分自动计算局分（{derivedOk.hw} : {derivedOk.aw}）</p>}
            {derivedErr && <p className="text-xs text-red-500 mt-2">{derivedErr}</p>}
            {!derivedOk && !derivedErr && <p className="text-xs text-slate-400 mt-2">不填则只记录局分（该场净胜分按 0 计算）</p>}
          </div>
        )}

        <div className="flex gap-2 mt-6">
          <Button variant="secondary" className="flex-1" onClick={onClose}>取消</Button>
          <Button className="flex-1" onClick={save} disabled={busy || !!derivedErr}>保存</Button>
        </div>
      </div>
    </div>
  );
}
