// 管理员使用说明：所有管理员可查看；仅超管可编辑（Markdown）。
import { useEffect, useState } from 'react';
import { getAdminSettings, setAdminGuide } from '../lib/api';
import { useAuth } from '../lib/auth';
import AdminLayout from '../components/AdminLayout';
import { Button, Spinner, Toast } from '../components/ui';
import { MarkdownEditor, MarkdownView } from '../components/Markdown';
import { useToast } from '../lib/useToast';

export default function AdminGuide() {
  const { isSuperAdmin } = useAuth();
  const [guide, setGuide] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const { toast, showSuccess, showError } = useToast();

  useEffect(() => {
    getAdminSettings().then((d) => { setGuide(d.admin_guide); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  async function save() {
    setBusy(true);
    try {
      await setAdminGuide(draft);
      setGuide(draft);
      setEditing(false);
      showSuccess('使用说明已保存');
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
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">管理员使用说明</h2>
          {isSuperAdmin && !editing && (
            <Button variant="secondary" onClick={() => { setDraft(guide); setEditing(true); }}>编辑</Button>
          )}
        </div>

        {editing ? (
          <>
            <MarkdownEditor value={draft} onChange={setDraft} rows={16} />
            <div className="flex gap-2 mt-3">
              <Button variant="secondary" onClick={() => setEditing(false)}>取消</Button>
              <Button onClick={save} disabled={busy}>保存</Button>
            </div>
          </>
        ) : guide ? (
          <MarkdownView source={guide} />
        ) : (
          <p className="text-slate-400 text-sm">
            {isSuperAdmin ? '暂无使用说明，点击右上角「编辑」来撰写。' : '暂无使用说明，请联系超级管理员补充。'}
          </p>
        )}
      </div>
    </AdminLayout>
  );
}
