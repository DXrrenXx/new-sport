// 后台首页：按筛选查看比赛 → 录入比分（存后自动重算排行榜）→ 公告设置。
import { useEffect, useState } from 'react';
import {
  fetchGrades, fetchSports, fetchWeeks, fetchMatches,
  updateMatchResult, recalcRankings, getAdminSettings, setAnnouncement, setFooter,
} from '../lib/api';
import type { Grade, Sport, EnrichedMatch } from '../lib/types';
import { useAuth } from '../lib/auth';
import AdminLayout from '../components/AdminLayout';
import { GradeSportWeekFilter } from '../components/Filters';
import { Button, Spinner, StatusBadge, Toast } from '../components/ui';
import { MarkdownEditor } from '../components/Markdown';
import { useToast } from '../lib/useToast';

export default function AdminDashboard() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [weeks, setWeeks] = useState<number[]>([]);
  const [gradeId, setGradeId] = useState<number | ''>('');
  const [sportId, setSportId] = useState<number | ''>('');
  const [week, setWeek] = useState<number | ''>('');
  const [matches, setMatches] = useState<EnrichedMatch[]>([]);
  const [editing, setEditing] = useState<EnrichedMatch | null>(null);
  const [hs, setHs] = useState('');
  const [as, setAs] = useState('');
  const [announcement, setAnn] = useState('');
  const [footer, setFoot] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const { isSuperAdmin } = useAuth();
  const { toast, showSuccess, showError } = useToast();

  useEffect(() => {
    (async () => {
      const [g, s] = await Promise.all([fetchGrades(), fetchSports()]);
      setGrades(g); setSports(s);
      if (g.length) setGradeId(g[0].id);
      if (s.length) setSportId(s[0].id);
      getAdminSettings().then((d) => { setAnn(d.content); setFoot(d.footer); }).catch(() => {});
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!gradeId || !sportId) return;
    fetchWeeks(gradeId, sportId).then((w) => { setWeeks(w); setWeek(w.length ? w[0] : ''); });
  }, [gradeId, sportId]);

  const reload = () => {
    if (!gradeId || !sportId || week === '') { setMatches([]); return; }
    fetchMatches({ gradeId, sportId, week }).then(setMatches);
  };
  useEffect(reload, [gradeId, sportId, week]);

  function openEdit(m: EnrichedMatch) {
    setEditing(m);
    setHs(m.home_score?.toString() ?? '');
    setAs(m.away_score?.toString() ?? '');
  }

  async function saveScore() {
    if (!editing) return;
    if (hs === '' || as === '') return showError('请填写双方得分');
    setBusy(true);
    try {
      await updateMatchResult(editing.id, Number(hs), Number(as));
      showSuccess('比赛结果已保存，排行榜已自动更新');
      setEditing(null);
      reload();
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRecalc() {
    if (!gradeId) return;
    setBusy(true);
    try {
      await recalcRankings(gradeId);
      showSuccess('排行榜已重新计算');
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveAnnouncement() {
    setBusy(true);
    try {
      await setAnnouncement(announcement);
      showSuccess('公告已保存');
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveFooter() {
    setBusy(true);
    try {
      await setFooter(footer);
      showSuccess('页脚已保存');
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <AdminLayout><Spinner /></AdminLayout>;

  return (
    <AdminLayout>
      <Toast msg={toast.msg} type={toast.type} />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <GradeSportWeekFilter
              grades={grades} sports={sports} weeks={weeks}
              gradeId={gradeId} sportId={sportId} week={week}
              onGrade={setGradeId} onSport={setSportId} onWeek={setWeek}
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <h2 className="px-4 py-3 font-semibold border-b border-slate-100">比赛结果录入</h2>
            {matches.length === 0 ? (
              <p className="p-6 text-center text-slate-400 text-sm">该筛选条件下暂无比赛</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left">主队</th>
                    <th className="px-4 py-2 text-center">比分</th>
                    <th className="px-4 py-2 text-left">客队</th>
                    <th className="px-4 py-2 text-center">状态</th>
                    <th className="px-4 py-2 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m) => (
                    <tr key={m.id} className="border-t border-slate-50">
                      <td className="px-4 py-2">{m.home_class_name}</td>
                      <td className="px-4 py-2 text-center font-mono">
                        {m.status === 'completed' ? `${m.home_score} : ${m.away_score}` : '—'}
                      </td>
                      <td className="px-4 py-2">{m.away_class_name}</td>
                      <td className="px-4 py-2 text-center"><StatusBadge status={m.status} /></td>
                      <td className="px-4 py-2 text-right">
                        <Button variant="secondary" onClick={() => openEdit(m)}>录入</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <h2 className="font-semibold mb-2">排行榜</h2>
            <p className="text-sm text-slate-500 mb-3">录入比分后会自动重算。如需手动强制重算可点击下方按钮。</p>
            <Button variant="secondary" onClick={handleRecalc} disabled={busy}>重新计算当前年级排行榜</Button>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <h2 className="font-semibold mb-2">公告设置</h2>
            <p className="text-sm text-slate-500 mb-3">显示在前台首页顶部，支持 Markdown。</p>
            <MarkdownEditor value={announcement} onChange={setAnn} rows={8} />
            <div className="mt-3">
              <Button onClick={saveAnnouncement} disabled={busy}>保存公告</Button>
            </div>
          </div>

          {isSuperAdmin && (
            <div className="bg-white rounded-xl border border-slate-100 p-4">
              <h2 className="font-semibold mb-2">页脚设置</h2>
              <p className="text-sm text-slate-500 mb-3">显示在前台页面最底部（仅超级管理员可改）。</p>
              <textarea
                value={footer}
                onChange={(e) => setFoot(e.target.value)}
                rows={2}
                className="w-full border border-slate-300 rounded-lg p-3 text-sm outline-none focus:border-brand resize-y"
              />
              <div className="mt-3">
                <Button onClick={saveFooter} disabled={busy}>保存页脚</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-40" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-4">录入比分</h3>
            <div className="flex items-center gap-3 justify-center">
              <div className="text-center">
                <div className="text-sm text-slate-500 mb-1">{editing.home_class_name}</div>
                <input type="number" min="0" value={hs} onChange={(e) => setHs(e.target.value)}
                  className="w-20 border border-slate-300 rounded-lg px-3 py-2 text-center text-lg outline-none focus:border-brand" />
              </div>
              <span className="text-2xl text-slate-300 mt-5">:</span>
              <div className="text-center">
                <div className="text-sm text-slate-500 mb-1">{editing.away_class_name}</div>
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
