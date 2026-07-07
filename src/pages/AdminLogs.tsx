// 管理员操作日志（仅超管可访问，路由已加 requireSuper 守卫，后端也二次校验）。
// 支持按操作人邮箱、操作类型筛选。
import { useEffect, useState } from 'react';
import { fetchAdminLogs } from '../lib/api';
import type { AdminLog } from '../lib/types';
import AdminLayout from '../components/AdminLayout';
import { Button, Spinner, Toast } from '../components/ui';
import { useToast } from '../lib/useToast';

const ACTION_LABELS: Record<string, string> = {
  update_match_result: '录入比分',
  match_create: '添加比赛',
  match_update: '修改比赛',
  match_delete: '删除比赛',
  batch_import: '批量导入',
  update_scoring_rules: '修改积分规则',
  create_sport: '新增项目',
  set_announcement: '修改公告',
  set_admin_guide: '修改使用说明',
  set_invite_code: '修改邀请码',
  create_grade: '新增年级',
  update_grade: '修改年级',
  delete_grade: '删除年级',
  create_class: '新增班级',
  update_class: '修改班级',
  delete_class: '删除班级',
};

export default function AdminLogs() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [actor, setActor] = useState('');
  const [actionType, setActionType] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast, showError } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminLogs({
        actor: actor || undefined,
        actionType: actionType || undefined,
      });
      setLogs(data);
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const actors = [...new Set(logs.map((l) => l.actor_email))];

  return (
    <AdminLayout>
      <Toast msg={toast.msg} type={toast.type} />
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-end gap-3">
          <h2 className="font-semibold mr-auto">操作日志</h2>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-500">操作人</span>
            <select value={actor} onChange={(e) => setActor(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 bg-white outline-none focus:border-brand">
              <option value="">全部</option>
              {actors.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-500">操作类型</span>
            <select value={actionType} onChange={(e) => setActionType(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 bg-white outline-none focus:border-brand">
              <option value="">全部</option>
              {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <Button variant="secondary" onClick={load}>筛选</Button>
        </div>

        {loading ? <Spinner /> : logs.length === 0 ? (
          <p className="p-6 text-center text-slate-400 text-sm">暂无日志</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">时间</th>
                <th className="px-4 py-2 text-left">操作人</th>
                <th className="px-4 py-2 text-left">操作</th>
                <th className="px-4 py-2 text-left">详情</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-slate-50 align-top">
                  <td className="px-4 py-2 whitespace-nowrap text-slate-500">{new Date(l.created_at).toLocaleString('zh-CN')}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{l.actor_email}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{ACTION_LABELS[l.action_type] ?? l.action_type}</td>
                  <td className="px-4 py-2 text-slate-400 font-mono text-xs break-all max-w-md">
                    {JSON.stringify(l.detail)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}
