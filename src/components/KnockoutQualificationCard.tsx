// 淘汰赛管理子组件：手动出线（各组积分快照 + 首轮待定位置点选）。
import type { EnrichedMatch } from '../lib/types';
import type { StandingRow } from '../lib/standings';
import { sourceLabel } from '../lib/api';

export function KnockoutQualificationCard({
  round1, groupStandings, getCandidates, onFill,
}: {
  round1: EnrichedMatch[];
  groupStandings: Map<string, StandingRow[]>;
  getCandidates: (source: string | null) => { value: number; label: string }[];
  onFill: (m: EnrichedMatch, side: 'home' | 'away', classId: number) => void;
}) {
  const groupLabels = [...groupStandings.keys()].sort();
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4">
      <h2 className="font-semibold mb-1">手动出线</h2>
      <p className="text-sm text-slate-500 mb-3">小组赛结束后，为每个待定位置点选出线班级（参考下方各组积分）。</p>
      {groupLabels.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {groupLabels.map((g) => (
            <div key={g} className="border border-slate-100 rounded-lg p-3">
              <div className="text-sm font-semibold mb-1">{g}组</div>
              <table className="w-full text-xs">
                <thead className="text-slate-400">
                  <tr><th className="text-left font-normal">班级</th><th className="text-center font-normal">胜</th><th className="text-center font-normal">负</th><th className="text-center font-normal">平</th><th className="text-center font-normal">积分</th></tr>
                </thead>
                <tbody>
                  {(groupStandings.get(g) ?? []).map((r) => (
                    <tr key={r.classId} className="border-t border-slate-50">
                      <td>{r.name}</td>
                      <td className="text-center">{r.wins}</td>
                      <td className="text-center">{r.losses}</td>
                      <td className="text-center">{r.draws}</td>
                      <td className="text-center font-semibold text-brand">{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-2">
        {round1.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-3 border border-slate-100 rounded-lg p-3 text-sm">
            <FillSide
              name={m.home_class_name}
              source={m.home_source}
              candidates={getCandidates(m.home_source)}
              onPick={(v) => onFill(m, 'home', v)}
            />
            <span className="text-slate-300 font-semibold">vs</span>
            <FillSide
              name={m.away_class_name}
              source={m.away_source}
              candidates={getCandidates(m.away_source)}
              onPick={(v) => onFill(m, 'away', v)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function FillSide({
  name, source, candidates, onPick,
}: {
  name: string; source: string | null;
  candidates: { value: number; label: string }[];
  onPick: (v: number) => void;
}) {
  if (name) {
    return (
      <div className="font-medium">
        {name}
        {source && <span className="ml-1 text-xs text-slate-400">{sourceLabel(source)}</span>}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400">{sourceLabel(source) || '未指定来源'}</span>
      <select
        value={0}
        onChange={(e) => { if (Number(e.target.value)) onPick(Number(e.target.value)); }}
        className="border border-slate-300 rounded-lg px-3 py-2 bg-white outline-none focus:border-brand"
      >
        <option value={0}>选择出线班</option>
        {candidates.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
