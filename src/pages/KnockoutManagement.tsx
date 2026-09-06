// 后台淘汰赛管理：生成骨架（首轮场数→自动生成全部轮次+三四名）、手动出线、录分与重置。
import { useEffect, useMemo, useState } from 'react';
import {
  fetchGrades, fetchSports, fetchClasses, fetchMatches,
  createMatch, updateMatch, updateMatchResult, resetMatch, deleteMatch,
  sourceLabel, roundLabel,
} from '../lib/api';
import type { Grade, Sport, ClassRow, EnrichedMatch } from '../lib/types';
import AdminLayout from '../components/AdminLayout';
import { Select } from '../components/Filters';
import { Button, Spinner, StatusBadge, Toast } from '../components/ui';
import { useToast } from '../lib/useToast';

// 首轮自动标注来源（仅常见规模；其他规模留 TBD 由管理员手动填写）
const AUTO_PAIRS: Record<number, [string | null, string | null][]> = {
  1: [['group:A:1', 'group:B:1']],
  2: [['group:A:1', 'group:B:1'], ['group:C:1', 'group:D:1']],
  4: [
    ['group:A:1', 'group:B:2'], ['group:B:1', 'group:A:2'],
    ['group:C:1', 'group:D:2'], ['group:D:1', 'group:C:2'],
  ],
};

interface StandingRow { classId: number; name: string; points: number; wins: number; losses: number; draws: number }

export default function KnockoutManagement() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [gradeId, setGradeId] = useState<number | ''>('');
  const [sportId, setSportId] = useState<number | ''>('');
  const [allMatches, setAllMatches] = useState<EnrichedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // 生成骨架表单
  const [firstRound, setFirstRound] = useState(2);
  const [startWeek, setStartWeek] = useState(6);
  const [includeThird, setIncludeThird] = useState(true);

  // 录分弹窗
  const [editing, setEditing] = useState<EnrichedMatch | null>(null);
  const [hs, setHs] = useState('');
  const [as, setAs] = useState('');

  const { toast, showSuccess, showError } = useToast();

  useEffect(() => {
    (async () => {
      const [g, s, c] = await Promise.all([fetchGrades(), fetchSports(), fetchClasses()]);
      setGrades(g); setSports(s); setClasses(c);
      if (g.length) setGradeId(g[0].id);
      if (s.length) setSportId(s[0].id);
      setLoading(false);
    })();
  }, []);

  const load = () => {
    if (!gradeId || !sportId) { setAllMatches([]); return; }
    fetchMatches({ gradeId, sportId, stage: 'all' }).then(setAllMatches).catch(() => {});
  };
  useEffect(load, [gradeId, sportId]);

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);
  const groupMatches = useMemo(() => allMatches.filter((m) => m.stage === 'group'), [allMatches]);
  const koMatches = useMemo(() => allMatches.filter((m) => m.stage !== 'group'), [allMatches]);
  const maxRound = useMemo(() => Math.max(0, ...koMatches.map((m) => m.round ?? 0)), [koMatches]);
  const sport = sports.find((s) => s.id === sportId);

  // 各组积分快照（前端现算：小组赛比赛 × 积分规则）
  const groupStandings = useMemo(() => {
    const rules = sport?.scoring_rules ?? { win: 3, draw: 1, loss: 0 };
    const byGroup = new Map<string, Map<number, StandingRow>>();
    for (const m of groupMatches) {
      if (m.result === 'pending' || !m.group_label || m.home_class_id == null || m.away_class_id == null) continue;
      const g = m.group_label;
      if (!byGroup.has(g)) byGroup.set(g, new Map());
      const map = byGroup.get(g)!;
      const H = map.get(m.home_class_id) ?? { classId: m.home_class_id, name: classMap.get(m.home_class_id) ?? '?', points: 0, wins: 0, losses: 0, draws: 0 };
      const A = map.get(m.away_class_id) ?? { classId: m.away_class_id, name: classMap.get(m.away_class_id) ?? '?', points: 0, wins: 0, losses: 0, draws: 0 };
      if (m.result === 'home_win') { H.points += rules.win; H.wins += 1; A.points += rules.loss; A.losses += 1; }
      else if (m.result === 'away_win') { H.points += rules.loss; H.losses += 1; A.points += rules.win; A.wins += 1; }
      else { H.points += rules.draw; H.draws += 1; A.points += rules.draw; A.draws += 1; }
      map.set(m.home_class_id, H); map.set(m.away_class_id, A);
    }
    const result = new Map<string, StandingRow[]>();
    for (const [g, map] of byGroup) {
      const rows = [...map.values()];
      rows.sort((a, b) => b.points - a.points || b.wins - a.wins || a.losses - b.losses);
      result.set(g, rows);
    }
    return result;
  }, [groupMatches, sport, classMap]);

  // 某位置的候选班级：group 来源 → 该组积分排序列表；无来源 → 全年级班级
  function candidates(source: string | null): { value: number; label: string }[] {
    const gm = /^group:(.+):\d+$/.exec(source ?? '');
    if (gm) {
      return (groupStandings.get(gm[1]) ?? [])
        .map((r) => ({ value: r.classId, label: `${r.name}（${r.points}分）` }));
    }
    return classes.filter((c) => c.grade_id === gradeId).map((c) => ({ value: c.id, label: c.name }));
  }

  async function generateSkeleton() {
    if (!gradeId || !sportId) return showError('请先选择年级和项目');
    if (koMatches.length > 0) return showError('该年级项目已存在淘汰赛。如需重建，请先删除现有淘汰赛比赛');
    if (includeThird && firstRound < 2) return showError('首轮只有 1 场（直接决赛）时没有三四名赛');
    setBusy(true);
    const createdIds: number[] = [];
    try {
      const n = firstRound;
      const R = Math.round(Math.log2(n)) + 1; // 总轮数（含决赛）
      const pairs = AUTO_PAIRS[n] ?? [];
      const byRound: { id: number }[][] = [];
      // 首轮
      const r1: { id: number }[] = [];
      for (let i = 0; i < n; i++) {
        const [hsrc, asrc] = pairs[i] ?? [null, null];
        const row = await createMatch({
          grade_id: gradeId, sport_id: sportId, week: startWeek,
          stage: 'knockout', round: 1,
          home_source: hsrc, away_source: asrc, status: 'pending',
        }) as { id: number };
        r1.push(row); createdIds.push(row.id);
      }
      byRound.push(r1);
      // 后续轮次（每轮减半，胜者晋级）
      for (let r = 2; r <= R; r++) {
        const prev = byRound[r - 2];
        const ids: { id: number }[] = [];
        for (let i = 0; i < prev.length / 2; i++) {
          const row = await createMatch({
            grade_id: gradeId, sport_id: sportId, week: startWeek + r - 1,
            stage: 'knockout', round: r,
            home_source: `winner:${prev[i * 2].id}`, away_source: `winner:${prev[i * 2 + 1].id}`,
            status: 'pending',
          }) as { id: number };
          ids.push(row); createdIds.push(row.id);
        }
        byRound.push(ids);
      }
      // 三四名赛（负者来自半决赛两场）
      if (includeThird && n >= 2) {
        const semis = byRound[R - 2];
        const row = await createMatch({
          grade_id: gradeId, sport_id: sportId, week: startWeek + R - 1,
          stage: 'third', round: R,
          home_source: `loser:${semis[0].id}`, away_source: `loser:${semis[1].id}`,
          status: 'pending',
        }) as { id: number };
        createdIds.push(row.id);
      }
      showSuccess(`已生成淘汰赛：${n * 2 - 1} 场（${R} 轮）${includeThird && n >= 2 ? ' + 三四名赛' : ''}，首轮周次为第${startWeek}周`);
      load();
    } catch (e) {
      // 生成中途失败：逆序删除已创建的比赛，避免残留半成品骨架
      for (const id of [...createdIds].reverse()) {
        try { await deleteMatch(id); } catch { /* 引用检查拦截的忽略，由管理员手动处理 */ }
      }
      showError(`${(e as Error).message}（本次生成已自动回滚）`);
    } finally {
      setBusy(false);
    }
  }

  async function fillPosition(m: EnrichedMatch, side: 'home' | 'away', classId: number) {
    try {
      await updateMatch(m.id, side === 'home' ? { home_class_id: classId } : { away_class_id: classId });
      showSuccess('出线队伍已填写');
      load();
    } catch (e) {
      showError((e as Error).message);
    }
  }

  async function saveScore() {
    if (!editing) return;
    if (hs === '' || as === '') return showError('请填写双方得分');
    if (Number(hs) === Number(as)) return showError('淘汰赛不允许平局');
    setBusy(true);
    try {
      await updateMatchResult(editing.id, Number(hs), Number(as));
      showSuccess('比赛结果已保存');
      setEditing(null);
      load();
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleReset(m: EnrichedMatch) {
    const label = m.stage === 'third' ? '三四名决赛' : roundLabel(m.round ?? 0, maxRound);
    if (!confirm(`确定重置「${label}」的这场比赛？\n比分将被清空，状态回到未开始。`)) return;
    try {
      await resetMatch(m.id);
      showSuccess('已重置');
      load();
    } catch (e) {
      showError((e as Error).message);
    }
  }

  function openEdit(m: EnrichedMatch) {
    setEditing(m);
    setHs(m.home_score?.toString() ?? '');
    setAs(m.away_score?.toString() ?? '');
  }

  const rounds = useMemo(() => {
    const map = new Map<number, EnrichedMatch[]>();
    for (const m of koMatches) {
      if (m.stage === 'third') continue;
      const r = m.round ?? 0;
      if (!map.has(r)) map.set(r, []);
      map.get(r)!.push(m);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [koMatches]);

  if (loading) return <AdminLayout><Spinner /></AdminLayout>;

  const round1 = koMatches.filter((m) => m.stage === 'knockout' && m.round === 1);
  const thirdMatch = koMatches.find((m) => m.stage === 'third');
  const groupLabels = [...groupStandings.keys()].sort();

  return (
    <AdminLayout>
      <Toast msg={toast.msg} type={toast.type} />
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-slate-100 p-4 flex flex-wrap items-end gap-3">
          <Select label="年级" value={gradeId} onChange={(v: number) => setGradeId(v)}
            options={grades.map((g) => ({ value: g.id, label: g.name }))} />
          <Select label="项目" value={sportId} onChange={(v: number) => setSportId(v)}
            options={sports.map((s) => ({ value: s.id, label: s.name }))} />
        </div>

        {/* 生成骨架 */}
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
            <Button onClick={generateSkeleton} disabled={busy}>{busy ? '生成中…' : '生成淘汰赛'}</Button>
          </div>
        </div>

        {/* 手动出线 */}
        {round1.length > 0 && (
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
                    candidates={candidates(m.home_source)}
                    onPick={(v) => fillPosition(m, 'home', v)}
                  />
                  <span className="text-slate-300 font-semibold">vs</span>
                  <FillSide
                    name={m.away_class_name}
                    source={m.away_source}
                    candidates={candidates(m.away_source)}
                    onPick={(v) => fillPosition(m, 'away', v)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 淘汰赛比赛列表 */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <h2 className="px-4 py-3 font-semibold border-b border-slate-100">淘汰赛比赛</h2>
          {koMatches.length === 0 ? (
            <p className="p-6 text-center text-slate-400 text-sm">尚未生成淘汰赛，请先在上方「生成淘汰赛」</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {rounds.map(([r, ms]) => (
                <div key={r}>
                  <div className="px-4 py-2 text-sm font-medium text-brand bg-slate-50">{roundLabel(r, maxRound)}</div>
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
                              onClick={() => openEdit(m)}
                            >录入</button>
                            <button className="text-red-500 hover:underline" onClick={() => handleReset(m)}>重置</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              {thirdMatch && (
                <div>
                  <div className="px-4 py-2 text-sm font-medium text-brand bg-slate-50">三四名决赛</div>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-t border-slate-50">
                        <td className="px-4 py-2">
                          {thirdMatch.home_class_name || <span className="text-slate-400">待定{sourceLabel(thirdMatch.home_source) && <span className="text-xs"> · {sourceLabel(thirdMatch.home_source)}</span>}</span>}
                        </td>
                        <td className="px-2 py-2 text-center font-mono whitespace-nowrap">
                          {thirdMatch.status === 'completed' ? `${thirdMatch.home_score} : ${thirdMatch.away_score}` : '—'}
                        </td>
                        <td className="px-4 py-2">
                          {thirdMatch.away_class_name || <span className="text-slate-400">待定{sourceLabel(thirdMatch.away_source) && <span className="text-xs"> · {sourceLabel(thirdMatch.away_source)}</span>}</span>}
                        </td>
                        <td className="px-2 py-2 text-center"><StatusBadge status={thirdMatch.status} /></td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          <button
                            className="text-brand hover:underline mr-3 disabled:text-slate-300 disabled:cursor-not-allowed"
                            disabled={thirdMatch.home_class_id == null || thirdMatch.away_class_id == null}
                            onClick={() => openEdit(thirdMatch)}
                          >录入</button>
                          <button className="text-red-500 hover:underline" onClick={() => handleReset(thirdMatch)}>重置</button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-40" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-1">录入比分</h3>
            <p className="text-xs text-slate-400 mb-4">淘汰赛不允许平局，双方得分不能相同</p>
            <div className="flex items-center gap-3 justify-center">
              <div className="text-center">
                <div className="text-sm text-slate-500 mb-1">{editing.home_class_name || '待定'}</div>
                <input type="number" min="0" value={hs} onChange={(e) => setHs(e.target.value)}
                  className="w-20 border border-slate-300 rounded-lg px-3 py-2 text-center text-lg outline-none focus:border-brand" />
              </div>
              <span className="text-2xl text-slate-300 mt-5">:</span>
              <div className="text-center">
                <div className="text-sm text-slate-500 mb-1">{editing.away_class_name || '待定'}</div>
                <input type="number" min="0" value={as} onChange={(e) => setAs(e.target.value)}
                  className="w-20 border border-slate-300 rounded-lg px-3 py-2 text-center text-lg outline-none focus:border-brand" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="secondary" className="flex-1" onClick={() => setEditing(null)}>取消</Button>
              <Button className="flex-1" onClick={saveScore} disabled={busy}>保存</Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
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
