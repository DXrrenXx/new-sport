// 年级/项目/周次 三级筛选器，前台后台共用。
import type { Grade, Sport } from '../lib/types';

export function Select<T extends string | number>({
  label, value, onChange, options,
}: {
  label: string;
  value: T | '';
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => {
          const raw = e.target.value;
          const first = options[0]?.value;
          onChange((typeof first === 'number' ? Number(raw) : raw) as T);
        }}
        className="border border-slate-300 rounded-lg px-3 py-2 bg-white min-w-[7rem] outline-none focus:border-brand"
      >
        {options.map((o) => (
          <option key={String(o.value)} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function GradeSportWeekFilter({
  grades, sports, weeks,
  gradeId, sportId, week,
  onGrade, onSport, onWeek,
}: {
  grades: Grade[]; sports: Sport[]; weeks: number[];
  gradeId: number | ''; sportId: number | ''; week: number | '';
  onGrade: (v: number) => void; onSport: (v: number) => void; onWeek: (v: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <Select label="年级" value={gradeId} onChange={onGrade}
        options={grades.map((g) => ({ value: g.id, label: g.name }))} />
      <Select label="项目" value={sportId} onChange={onSport}
        options={sports.map((s) => ({ value: s.id, label: s.name }))} />
      <Select label="周次" value={week} onChange={onWeek}
        options={weeks.length ? weeks.map((w) => ({ value: w, label: `第${w}周` })) : [{ value: 0, label: '暂无' }]} />
    </div>
  );
}
