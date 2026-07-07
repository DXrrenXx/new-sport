// 项目积分规则设置：每个项目单独配置 胜/平/负 得分 + 是否允许平局。改后自动重算所有排行榜。
import { useEffect, useState } from 'react';
import { fetchSports, updateScoringRules } from '../lib/api';
import type { Sport } from '../lib/types';
import AdminLayout from '../components/AdminLayout';
import { Button, Spinner, Toast } from '../components/ui';
import { useToast } from '../lib/useToast';

export default function SportSettings() {
  const [sports, setSports] = useState<Sport[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const { toast, showSuccess, showError } = useToast();

  const load = () => fetchSports().then((s) => { setSports(s); setLoading(false); });
  useEffect(() => { load(); }, []);

  function patch(id: number, key: keyof Sport['scoring_rules'], value: number | boolean) {
    setSports((prev) => prev.map((s) => s.id === id ? { ...s, scoring_rules: { ...s.scoring_rules, [key]: value } } : s));
  }

  async function save(sport: Sport) {
    setSavingId(sport.id);
    try {
      await updateScoringRules(sport.id, { ...sport.scoring_rules });
      showSuccess(`${sport.name} 的积分规则已保存，排行榜已重算`);
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <AdminLayout><Spinner /></AdminLayout>;

  return (
    <AdminLayout>
      <Toast msg={toast.msg} type={toast.type} />
      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <h2 className="font-semibold mb-1">项目积分规则</h2>
        <p className="text-sm text-slate-500 mb-4">
          每个项目可单独设置胜、平、负得分。关闭「允许平局」的项目（如篮球、排球、乒乓球），录入比分时不允许出现平局。修改保存后会自动重新计算所有排行榜。
        </p>
        <div className="space-y-3">
          {sports.map((s) => (
            <div key={s.id} className="flex flex-wrap items-end gap-4 border border-slate-100 rounded-lg p-3">
              <div className="w-20 font-medium">{s.name}</div>
              <NumField label="胜" value={s.scoring_rules.win} onChange={(v) => patch(s.id, 'win', v)} />
              <NumField label="平" value={s.scoring_rules.draw} onChange={(v) => patch(s.id, 'draw', v)} disabled={!s.scoring_rules.allow_draw} />
              <NumField label="负" value={s.scoring_rules.loss} onChange={(v) => patch(s.id, 'loss', v)} />
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={s.scoring_rules.allow_draw}
                  onChange={(e) => patch(s.id, 'allow_draw', e.target.checked)} />
                允许平局
              </label>
              <Button onClick={() => save(s)} disabled={savingId === s.id}>
                {savingId === s.id ? '保存中…' : '保存'}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}

function NumField({
  label, value, onChange, disabled,
}: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <input type="number" value={value} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-center outline-none focus:border-brand disabled:bg-slate-100 disabled:text-slate-400" />
    </label>
  );
}
