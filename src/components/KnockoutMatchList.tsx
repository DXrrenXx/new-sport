// 淘汰赛管理子组件：按轮次分组的比赛列表（含三四名），提供录入/重置入口。
import type { EnrichedMatch } from '../lib/types';
import { sourceLabel, roundLabel } from '../lib/api';
import { StatusBadge } from './ui';

export function KnockoutMatchList({
  koMatches, rounds, maxRound, thirdMatch, onEdit, onReset,
}: {
  koMatches: EnrichedMatch[];
  rounds: [number, EnrichedMatch[]][];
  maxRound: number;
  thirdMatch: EnrichedMatch | undefined;
  onEdit: (m: EnrichedMatch) => void;
  onReset: (m: EnrichedMatch) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
      <h2 className="px-4 py-3 font-semibold border-b border-slate-100">淘汰赛比赛</h2>
      {koMatches.length === 0 ? (
        <p className="p-6 text-center text-slate-400 text-sm">尚未生成淘汰赛，请先在上方「生成淘汰赛」</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {rounds.map(([r, ms]) => (
            <div key={r}>
              <div className="px-4 py-2 text-sm font-medium text-brand bg-slate-50">{roundLabel(r, maxRound)}</div>
              <MatchRows ms={ms} onEdit={onEdit} onReset={onReset} />
            </div>
          ))}
          {thirdMatch && (
            <div>
              <div className="px-4 py-2 text-sm font-medium text-brand bg-slate-50">三四名决赛</div>
              <MatchRows ms={[thirdMatch]} onEdit={onEdit} onReset={onReset} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MatchRows({
  ms, onEdit, onReset,
}: {
  ms: EnrichedMatch[];
  onEdit: (m: EnrichedMatch) => void;
  onReset: (m: EnrichedMatch) => void;
}) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {ms.map((m) => (
          <tr key={m.id} className="border-t border-slate-50">
            <td className="px-4 py-2">
              {m.home_class_name || <span className="text-slate-400">待定{sourceLabel(m.home_source) && <span className="text-xs"> · {sourceLabel(m.home_source)}</span>}</span>}
            </td>
            <td className="px-2 py-2 text-center font-mono whitespace-nowrap">
              {m.status === 'completed' ? `${m.home_score} : ${m.away_score}` : '—'}
            </td>
            <td className="px-4 py-2">
              {m.away_class_name || <span className="text-slate-400">待定{sourceLabel(m.away_source) && <span className="text-xs"> · {sourceLabel(m.away_source)}</span>}</span>}
            </td>
            <td className="px-2 py-2 text-center"><StatusBadge status={m.status} /></td>
            <td className="px-4 py-2 text-right whitespace-nowrap">
              <button
                className="text-brand hover:underline mr-3 disabled:text-slate-300 disabled:cursor-not-allowed"
                disabled={m.home_class_id == null || m.away_class_id == null}
                onClick={() => onEdit(m)}
              >录入</button>
              <button className="text-red-500 hover:underline" onClick={() => onReset(m)}>重置</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
