// 赛程管理：增删改查 + 批量导入(JSON/CSV) + 导出(JSON/CSV) + 批量删除。
import { useEffect, useMemo, useState } from 'react';
import {
  fetchGrades, fetchSports, fetchClasses, fetchWeeks, fetchMatches,
  createMatch, updateMatch, deleteMatch, batchImport,
} from '../lib/api';
import type { Grade, Sport, ClassRow, EnrichedMatch, MatchStatus } from '../lib/types';
import AdminLayout from '../components/AdminLayout';
import { GradeSportWeekFilter, Select } from '../components/Filters';
import { Button, Spinner, StatusBadge, Toast } from '../components/ui';
import { useToast } from '../lib/useToast';

const STATUS_OPTS: { value: MatchStatus; label: string }[] = [
  { value: 'pending', label: '未开始' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已结束' },
];

export default function ScheduleManagement() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [weeks, setWeeks] = useState<number[]>([]);
  const [gradeId, setGradeId] = useState<number | ''>('');
  const [sportId, setSportId] = useState<number | ''>('');
  const [week, setWeek] = useState<number | ''>('');
  const [matches, setMatches] = useState<EnrichedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editRow, setEditRow] = useState<number | null>(null);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const { toast, showSuccess, showError } = useToast();

  const gradeClasses = useMemo(() => classes.filter((c) => c.grade_id === gradeId), [classes, gradeId]);

  useEffect(() => {
    (async () => {
      const [g, s, c] = await Promise.all([fetchGrades(), fetchSports(), fetchClasses()]);
      setGrades(g); setSports(s); setClasses(c);
      if (g.length) setGradeId(g[0].id);
      if (s.length) setSportId(s[0].id);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!gradeId || !sportId) return;
    fetchWeeks(gradeId, sportId).then(setWeeks);
  }, [gradeId, sportId, matches]);

  const reload = () => {
    if (!gradeId || !sportId) { setMatches([]); return; }
    fetchMatches({ gradeId, sportId, week: week === '' ? undefined : week }).then(setMatches);
  };
  useEffect(reload, [gradeId, sportId, week]);

  // ---------- 导出 ----------
  function toFriendly(m: EnrichedMatch) {
    return {
      grade: m.grade_name, sport: m.sport_name, week: m.week,
      homeClass: m.home_class_name, awayClass: m.away_class_name,
      score: m.status === 'completed' ? `${m.home_score}:${m.away_score}` : '',
      status: m.status,
    };
  }
  function download(name: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }
  function exportJSON() {
    download('赛程.json', JSON.stringify(matches.map(toFriendly), null, 2), 'application/json');
  }
  function exportCSV() {
    const header = 'ID,年级,项目,周次,主队,客队,比分,状态';
    const rows = matches.map((m) => {
      const f = toFriendly(m);
      return [m.id, f.grade, f.sport, f.week, f.homeClass, f.awayClass, f.score, f.status].join(',');
    });
    download('赛程.csv', '﻿' + [header, ...rows].join('\n'), 'text/csv');
  }

  // ---------- 批量删除 ----------
  async function deleteAll() {
    if (!matches.length) return showError('当前没有可删除的比赛');
    if (!confirm(`确认删除当前筛选下的所有比赛？共 ${matches.length} 场将被永久删除！\n建议先导出备份。`)) return;
    if (!confirm('此操作不可恢复！确定继续吗？')) return;
    exportJSON(); // 自动备份
    setBusy(true);
    try {
      for (const m of matches) await deleteMatch(m.id);
      showSuccess('已删除所选比赛，排行榜已自动更新');
      reload();
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('确定删除这场比赛？')) return;
    try { await deleteMatch(id); showSuccess('已删除'); reload(); }
    catch (e) { showError((e as Error).message); }
  }

  function startEdit(m: EnrichedMatch) {
    setEditRow(m.id);
    setEditData({
      week: String(m.week), status: m.status,
      home_score: m.home_score?.toString() ?? '', away_score: m.away_score?.toString() ?? '',
    });
  }
  async function saveEdit(id: number) {
    try {
      const patch: Record<string, unknown> = {
        week: Number(editData.week), status: editData.status,
      };
      if (editData.home_score !== '') patch.home_score = Number(editData.home_score);
      if (editData.away_score !== '') patch.away_score = Number(editData.away_score);
      await updateMatch(id, patch);
      showSuccess('已保存'); setEditRow(null); reload();
    } catch (e) { showError((e as Error).message); }
  }

  if (loading) return <AdminLayout><Spinner /></AdminLayout>;

  return (
    <AdminLayout>
      <Toast msg={toast.msg} type={toast.type} />
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-slate-100 p-4 flex flex-wrap items-end justify-between gap-3">
          <GradeSportWeekFilter
            grades={grades} sports={sports} weeks={[0, ...weeks]}
            gradeId={gradeId} sportId={sportId} week={week}
            onGrade={setGradeId} onSport={setSportId} onWeek={(w) => setWeek(w === 0 ? '' : w)}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowAdd(!showAdd)}>添加比赛</Button>
            <Button variant="secondary" onClick={() => setShowImport(!showImport)}>批量导入</Button>
            <Button variant="secondary" onClick={exportJSON}>导出JSON</Button>
            <Button variant="secondary" onClick={exportCSV}>导出CSV</Button>
            <Button variant="danger" onClick={deleteAll} disabled={busy}>删除全部</Button>
          </div>
        </div>

        {showAdd && (
          <AddMatchForm
            grades={grades} sports={sports} classes={classes}
            defaultGrade={gradeId} defaultSport={sportId}
            onDone={() => { setShowAdd(false); reload(); }}
            onError={showError} onSuccess={showSuccess}
          />
        )}

        {showImport && (
          <ImportPanel
            onDone={() => { setShowImport(false); reload(); }}
            onError={showError} onSuccess={showSuccess}
          />
        )}

        <div className="bg-white rounded-xl border border-slate-100 overflow-x-auto">
          {matches.length === 0 ? (
            <p className="p-6 text-center text-slate-400 text-sm">暂无比赛</p>
          ) : (
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">周次</th>
                  <th className="px-3 py-2 text-left">主队</th>
                  <th className="px-3 py-2 text-center">比分</th>
                  <th className="px-3 py-2 text-left">客队</th>
                  <th className="px-3 py-2 text-center">状态</th>
                  <th className="px-3 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m) => (
                  <tr key={m.id} className="border-t border-slate-50">
                    {editRow === m.id ? (
                      <>
                        <td className="px-3 py-2">
                          <input type="number" value={editData.week} onChange={(e) => setEditData({ ...editData, week: e.target.value })}
                            className="w-14 border rounded px-2 py-1" />
                        </td>
                        <td className="px-3 py-2">{m.home_class_name}</td>
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          <input type="number" value={editData.home_score} onChange={(e) => setEditData({ ...editData, home_score: e.target.value })}
                            className="w-12 border rounded px-1 py-1 text-center" /> :
                          <input type="number" value={editData.away_score} onChange={(e) => setEditData({ ...editData, away_score: e.target.value })}
                            className="w-12 border rounded px-1 py-1 text-center" />
                        </td>
                        <td className="px-3 py-2">{m.away_class_name}</td>
                        <td className="px-3 py-2 text-center">
                          <select value={editData.status} onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                            className="border rounded px-2 py-1">
                            {STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <button className="text-brand hover:underline mr-3" onClick={() => saveEdit(m.id)}>保存</button>
                          <button className="text-slate-400 hover:underline" onClick={() => setEditRow(null)}>取消</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2">第{m.week}周</td>
                        <td className="px-3 py-2">{m.home_class_name}</td>
                        <td className="px-3 py-2 text-center font-mono">
                          {m.status === 'completed' ? `${m.home_score} : ${m.away_score}` : '—'}
                        </td>
                        <td className="px-3 py-2">{m.away_class_name}</td>
                        <td className="px-3 py-2 text-center"><StatusBadge status={m.status} /></td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <button className="text-brand hover:underline mr-3" onClick={() => startEdit(m)}>编辑</button>
                          <button className="text-red-500 hover:underline" onClick={() => handleDelete(m.id)}>删除</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

// ---------- 添加比赛表单 ----------
function AddMatchForm({
  grades, sports, classes, defaultGrade, defaultSport, onDone, onError, onSuccess,
}: {
  grades: Grade[]; sports: Sport[]; classes: ClassRow[];
  defaultGrade: number | ''; defaultSport: number | '';
  onDone: () => void; onError: (m: string) => void; onSuccess: (m: string) => void;
}) {
  const [gradeId, setGradeId] = useState<number | ''>(defaultGrade);
  const [sportId, setSportId] = useState<number | ''>(defaultSport);
  const [week, setWeek] = useState('1');
  const [home, setHome] = useState<number | ''>('');
  const [away, setAway] = useState<number | ''>('');
  const [status, setStatus] = useState<MatchStatus>('pending');
  const [busy, setBusy] = useState(false);

  const gradeClasses = classes.filter((c) => c.grade_id === gradeId);

  async function submit() {
    if (!gradeId || !sportId || !home || !away) return onError('请完整填写');
    if (home === away) return onError('主队和客队不能相同');
    setBusy(true);
    try {
      await createMatch({
        grade_id: gradeId, sport_id: sportId, week: Number(week),
        home_class_id: home, away_class_id: away, status,
      });
      onSuccess('比赛已添加'); onDone();
    } catch (e) { onError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4">
      <h3 className="font-semibold mb-3">添加比赛</h3>
      <div className="flex flex-wrap items-end gap-3">
        <Select label="年级" value={gradeId} onChange={(v: number) => { setGradeId(v); setHome(''); setAway(''); }}
          options={grades.map((g) => ({ value: g.id, label: g.name }))} />
        <Select label="项目" value={sportId} onChange={(v: number) => setSportId(v)}
          options={sports.map((s) => ({ value: s.id, label: s.name }))} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-500">周次</span>
          <input type="number" min="1" value={week} onChange={(e) => setWeek(e.target.value)}
            className="w-20 border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-brand" />
        </label>
        <Select label="主队" value={home} onChange={(v: number) => setHome(v)}
          options={[{ value: 0, label: '选择' }, ...gradeClasses.map((c) => ({ value: c.id, label: c.name }))]} />
        <Select label="客队" value={away} onChange={(v: number) => setAway(v)}
          options={[{ value: 0, label: '选择' }, ...gradeClasses.map((c) => ({ value: c.id, label: c.name }))]} />
        <Select label="状态" value={status} onChange={(v: MatchStatus) => setStatus(v)} options={STATUS_OPTS} />
        <Button onClick={submit} disabled={busy}>{busy ? '添加中…' : '添加'}</Button>
      </div>
    </div>
  );
}

// ---------- 批量导入面板 ----------
function ImportPanel({
  onDone, onError, onSuccess,
}: { onDone: () => void; onError: (m: string) => void; onSuccess: (m: string) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const sample = JSON.stringify([
    { grade: '高一', sport: '篮球', week: 1, homeClass: '1班', awayClass: '2班', score: '20:18', status: 'completed' },
    { grade: '高一', sport: '篮球', week: 1, homeClass: '3班', awayClass: '4班', score: '', status: 'pending' },
  ], null, 2);

  function parseCSV(csv: string) {
    const lines = csv.trim().split(/\r?\n/).filter(Boolean);
    // 跳过表头（若首行含"年级"）
    const start = lines[0]?.includes('年级') ? 1 : 0;
    return lines.slice(start).map((line) => {
      const [grade, sport, week, homeClass, awayClass, score, status] = line.split(',');
      return { grade, sport, week: Number(week), homeClass, awayClass, score: score ?? '', status: (status || 'pending').trim() };
    });
  }

  async function doImport(data: unknown[]) {
    if (!data.length) return onError('没有可导入的数据');
    setBusy(true);
    try {
      const res = await batchImport(data);
      onSuccess(`批量导入成功，共导入 ${(res as { inserted: number }).inserted} 场比赛`);
      onDone();
    } catch (e) { onError((e as Error).message); } finally { setBusy(false); }
  }

  function importJSON() {
    try { doImport(JSON.parse(text)); }
    catch { onError('JSON 格式错误，请检查'); }
  }

  function downloadTemplate() {
    const csv = '﻿年级,项目,周次,主队,客队,比分,状态\n高一,篮球,1,1班,2班,20:18,completed';
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = '导入模板.csv'; a.click();
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-3">
      <h3 className="font-semibold">批量导入</h3>
      <p className="text-sm text-slate-500">
        粘贴 JSON 数组，或上传/粘贴 CSV。班级名称会自动转换为对应 ID。比分留空或状态非 completed 视为未开始。
      </p>
      <div className="flex flex-wrap gap-2">
        <label className="cursor-pointer">
          <span className="inline-block px-4 py-2 rounded-lg text-sm bg-slate-100 hover:bg-slate-200">上传 CSV 文件</span>
          <input type="file" accept=".csv" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0]; if (!file) return;
            file.text().then((t) => doImport(parseCSV(t)));
          }} />
        </label>
        <Button variant="secondary" onClick={downloadTemplate}>下载 CSV 模板</Button>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder={sample}
        className="w-full border border-slate-300 rounded-lg p-3 font-mono text-xs outline-none focus:border-brand" />
      <div className="flex gap-2">
        <Button onClick={importJSON} disabled={busy || !text.trim()}>{busy ? '导入中…' : '导入 JSON'}</Button>
        <Button variant="secondary" onClick={() => setText(sample)}>填入示例</Button>
      </div>
    </div>
  );
}
