// 后台淘汰赛管理：数据加载与业务逻辑；界面拆分为三个子组件（生成骨架 / 手动出线 / 比赛列表）+ 共享录分弹窗。
import { useEffect, useMemo, useState } from 'react';
import {
  fetchGrades, fetchSports, fetchClasses, fetchMatches,
  createMatch, updateMatch, resetMatch, deleteMatch,
  roundLabel,
} from '../lib/api';
import type { Grade, Sport, ClassRow, EnrichedMatch } from '../lib/types';
import { computeStandings } from '../lib/standings';
import AdminLayout from '../components/AdminLayout';
import { Select } from '../components/Filters';
import { Spinner, Toast } from '../components/ui';
import { ScoreModal } from '../components/ScoreModal';
import { KnockoutSkeletonCard } from '../components/KnockoutSkeletonCard';
import { KnockoutQualificationCard } from '../components/KnockoutQualificationCard';
import { KnockoutMatchList } from '../components/KnockoutMatchList';
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

export default function KnockoutManagement() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [gradeId, setGradeId] = useState<number | ''>('');
  const [sportId, setSportId] = useState<number | ''>('');
  const [allMatches, setAllMatches] = useState<EnrichedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<EnrichedMatch | null>(null);

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

  // 各组积分快照（与前台分组排行榜共用同一套算法）
  const groupStandings = useMemo(
    () => computeStandings(groupMatches, sport?.scoring_rules ?? { win: 3, draw: 1, loss: 0, allow_draw: true }, classMap),
    [groupMatches, sport, classMap],
  );

  // 某位置的候选班级：group 来源 → 该组积分排序列表；无来源 → 全年级班级
  function candidates(source: string | null): { value: number; label: string }[] {
    const gm = /^group:(.+):\d+$/.exec(source ?? '');
    if (gm) {
      return (groupStandings.get(gm[1]) ?? [])
        .map((r) => ({ value: r.classId, label: `${r.name}（${r.points}分）` }));
    }
    return classes.filter((c) => c.grade_id === gradeId).map((c) => ({ value: c.id, label: c.name }));
  }

  async function generateSkeleton(opts: { firstRound: number; startWeek: number; includeThird: boolean }) {
    const { firstRound, startWeek, includeThird } = opts;
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

        <KnockoutSkeletonCard busy={busy} onGenerate={generateSkeleton} />

        {round1.length > 0 && (
          <KnockoutQualificationCard
            round1={round1}
            groupStandings={groupStandings}
            getCandidates={candidates}
            onFill={fillPosition}
          />
        )}

        <KnockoutMatchList
          koMatches={koMatches}
          rounds={rounds}
          maxRound={maxRound}
          thirdMatch={thirdMatch}
          onEdit={setEditing}
          onReset={handleReset}
        />
      </div>

      {editing && (
        <ScoreModal
          match={editing}
          knockout
          detailed={sport?.scoring_rules?.detailed ?? false}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
          onError={showError}
          onSuccess={showSuccess}
        />
      )}
    </AdminLayout>
  );
}
