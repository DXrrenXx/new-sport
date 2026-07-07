// 年级 / 班级管理：增删改。删除前后端会检查是否被比赛引用，防止孤立数据。
import { useEffect, useState } from 'react';
import { fetchGrades, fetchClasses, createTaxonomy, deleteTaxonomy } from '../lib/api';
import type { Grade, ClassRow } from '../lib/types';
import AdminLayout from '../components/AdminLayout';
import { Button, Spinner, Toast } from '../components/ui';
import { useToast } from '../lib/useToast';

export default function GradeClassSettings() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [selGrade, setSelGrade] = useState<number | ''>('');
  const [newGrade, setNewGrade] = useState('');
  const [newClass, setNewClass] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const { toast, showSuccess, showError } = useToast();

  const load = async () => {
    const [g, c] = await Promise.all([fetchGrades(), fetchClasses()]);
    setGrades(g); setClasses(c);
    if (g.length && selGrade === '') setSelGrade(g[0].id);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  async function addGrade() {
    if (!newGrade.trim()) return;
    setBusy(true);
    try {
      await createTaxonomy('grade', { name: newGrade.trim(), display_order: grades.length + 1 });
      setNewGrade(''); showSuccess('年级已添加'); await load();
    } catch (e) { showError((e as Error).message); } finally { setBusy(false); }
  }

  async function addClass() {
    if (!newClass.trim() || !selGrade) return;
    setBusy(true);
    try {
      await createTaxonomy('class', { name: newClass.trim(), grade_id: selGrade });
      setNewClass(''); showSuccess('班级已添加'); await load();
    } catch (e) { showError((e as Error).message); } finally { setBusy(false); }
  }

  async function removeGrade(id: number) {
    if (!confirm('确定删除该年级？（若下面还有班级或比赛将无法删除）')) return;
    try { await deleteTaxonomy('grade', id); showSuccess('已删除'); await load(); }
    catch (e) { showError((e as Error).message); }
  }

  async function removeClass(id: number) {
    if (!confirm('确定删除该班级？（若已被比赛引用将无法删除）')) return;
    try { await deleteTaxonomy('class', id); showSuccess('已删除'); await load(); }
    catch (e) { showError((e as Error).message); }
  }

  if (loading) return <AdminLayout><Spinner /></AdminLayout>;

  const gradeClasses = classes.filter((c) => c.grade_id === selGrade);

  return (
    <AdminLayout>
      <Toast msg={toast.msg} type={toast.type} />
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <h2 className="font-semibold mb-3">年级</h2>
          <div className="flex gap-2 mb-4">
            <input value={newGrade} onChange={(e) => setNewGrade(e.target.value)} placeholder="如 高一"
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-brand" />
            <Button onClick={addGrade} disabled={busy}>添加</Button>
          </div>
          <ul className="divide-y divide-slate-100">
            {grades.map((g) => (
              <li key={g.id} className="flex items-center justify-between py-2">
                <button className={`text-left ${selGrade === g.id ? 'font-semibold text-brand' : ''}`} onClick={() => setSelGrade(g.id)}>
                  {g.name}
                </button>
                <button className="text-xs text-red-500 hover:underline" onClick={() => removeGrade(g.id)}>删除</button>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <h2 className="font-semibold mb-3">
            班级 {selGrade ? <span className="text-slate-400 font-normal">· {grades.find((g) => g.id === selGrade)?.name}</span> : null}
          </h2>
          <div className="flex gap-2 mb-4">
            <input value={newClass} onChange={(e) => setNewClass(e.target.value)} placeholder="如 1班"
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-brand" />
            <Button onClick={addClass} disabled={busy || !selGrade}>添加</Button>
          </div>
          {gradeClasses.length === 0 ? (
            <p className="text-slate-400 text-sm">该年级暂无班级</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {gradeClasses.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2">
                  <span>{c.name}</span>
                  <button className="text-xs text-red-500 hover:underline" onClick={() => removeClass(c.id)}>删除</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
