// 前台公开淘汰赛对阵页：年级/项目选择 + 通用对阵树（按轮次分列）+ 三四名赛 + 冠军卡。
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  fetchGrades, fetchSports, fetchMatches, fetchSportIdsWithKnockout,
  sourceLabel, roundLabel,
} from '../lib/api';
import type { Grade, Sport, EnrichedMatch } from '../lib/types';
import { Select } from '../components/Filters';
import { Spinner } from '../components/ui';

export default function KnockoutPage() {
  const [params] = useSearchParams();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [koSportIds, setKoSportIds] = useState<number[]>([]);
  const [gradeId, setGradeId] = useState<number | ''>('');
  const [sportId, setSportId] = useState<number | ''>('');
  const [matches, setMatches] = useState<EnrichedMatch[]>([]);
  const [loading, setLoading] = useState(true);

  // 初始化：年级/项目可从 URL 参数带入
  useEffect(() => {
    (async () => {
      const [g, s] = await Promise.all([fetchGrades(), fetchSports()]);
      setGrades(g); setSports(s);
      const gid = Number(params.get('gradeId')) || (g[0]?.id ?? '');
      setGradeId(gid);
      const sid = Number(params.get('sportId')) || (s[0]?.id ?? '');
      setSportId(sid);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 年级变化 → 该年级有淘汰赛的项目
  useEffect(() => {
    if (!gradeId) return;
    fetchSportIdsWithKnockout(gradeId).then((ids) => {
      setKoSportIds(ids);
      setSportId((prev) => (prev && ids.includes(prev) ? prev : (ids.length ? ids[0] : '')));
    });
  }, [gradeId]);

  // 载入淘汰赛比赛
  useEffect(() => {
    if (!gradeId || !sportId) { setMatches([]); return; }
    fetchMatches({ gradeId, sportId, stage: 'all' }).then(setMatches);
  }, [gradeId, sportId]);

  const koMatches = useMemo(() => matches.filter((m) => m.stage !== 'group'), [matches]);
  const maxRound = useMemo(() => Math.max(0, ...koMatches.map((m) => m.round ?? 0)), [koMatches]);
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
  const thirdMatch = koMatches.find((m) => m.stage === 'third');
  const finalMatch = rounds.find(([r]) => r === maxRound)?.[1]?.[0];
  const champion = finalMatch
    ? (finalMatch.result === 'home_win' ? finalMatch.home_class_name : finalMatch.result === 'away_win' ? finalMatch.away_class_name : '')
    : '';
  const thirdWinner = thirdMatch
    ? (thirdMatch.result === 'home_win' ? thirdMatch.home_class_name : thirdMatch.result === 'away_win' ? thirdMatch.away_class_name : '')
    : '';

  if (loading) return <Spinner />;

  const visibleSports = sports.filter((s) => koSportIds.includes(s.id));

  return (
    <div className="min-h-screen">
      <header className="bg-brand text-white shadow">
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between gap-3">
          <h1 className="text-lg sm:text-2xl font-bold leading-tight">
            天津经济技术开发区第一中学
            <span className="block text-sm sm:text-base font-normal opacity-80 mt-1">淘汰赛对阵</span>
          </h1>
          <Link to="/" className="text-sm opacity-80 hover:opacity-100 underline whitespace-nowrap">← 返回首页</Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex flex-wrap gap-3">
          <Select label="年级" value={gradeId} onChange={(v: number) => { setGradeId(v); setSportId(''); }}
            options={grades.map((g) => ({ value: g.id, label: g.name }))} />
          <Select label="项目" value={sportId} onChange={(v: number) => setSportId(v)}
            options={visibleSports.length ? visibleSports.map((s) => ({ value: s.id, label: s.name })) : [{ value: 0, label: '暂无淘汰赛' }]} />
        </section>

        {koMatches.length === 0 ? (
          <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-10 text-center text-slate-400 text-sm">
            淘汰赛尚未排布
          </section>
        ) : (
          <>
            <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 overflow-x-auto">
              <div className="bracket-wrap">
                {rounds.map(([r, ms], idx) => (
                  <div key={r} className="flex items-stretch">
                    <div className="bracket-col">
                      <div className="bracket-round-label">{roundLabel(r, maxRound)}</div>
                      {ms.map((m) => <MatchCard key={m.id} m={m} roundLabel={roundLabel(r, maxRound)} />)}
                    </div>
                    {idx < rounds.length - 1 && <div className="bracket-gap" />}
                  </div>
                ))}
                <div className="flex items-stretch">
                  <div className="bracket-col">
                    <div className="bracket-round-label">冠军</div>
                    <div className={`bracket-card champion ${champion ? 'champion-done' : ''}`}>
                      {champion || '待定'}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {thirdMatch && (
              <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                <h2 className="font-semibold mb-3">三四名决赛</h2>
                <div className="bracket-col items-start">
                  <MatchCard m={thirdMatch} roundLabel="三四名" />
                </div>
                <p className="text-sm text-slate-500 mt-2">
                  {thirdWinner ? `季军：${thirdWinner}` : '待定'}
                </p>
              </section>
            )}
          </>
        )}

        <footer className="text-center text-xs text-slate-400 py-6">
          © 天津经济技术开发区第一中学 体育赛事管理系统
        </footer>
      </div>
    </div>
  );
}

function MatchCard({ m, roundLabel }: { m: EnrichedMatch; roundLabel: string }) {
  const homeWin = m.result === 'home_win';
  const awayWin = m.result === 'away_win';
  return (
    <div className="bracket-card">
      <div className="bracket-card-round">{roundLabel}</div>
      <TeamRow name={m.home_class_name} source={m.home_source} score={m.home_score} showScore={m.status === 'completed'} strong={homeWin} dimmed={awayWin} />
      <TeamRow name={m.away_class_name} source={m.away_source} score={m.away_score} showScore={m.status === 'completed'} strong={awayWin} dimmed={homeWin} />
    </div>
  );
}

function TeamRow({
  name, source, score, showScore, strong, dimmed,
}: {
  name: string; source: string | null; score: number | null; showScore: boolean; strong: boolean; dimmed: boolean;
}) {
  const label = name || `待定${source ? `·${sourceLabel(source)}` : ''}`;
  return (
    <div className={`flex items-center justify-between gap-2 ${strong ? 'font-bold text-brand' : dimmed ? 'opacity-40' : ''}`}>
      <span className="truncate">{label}</span>
      <span className="font-mono text-slate-500">{showScore && score != null ? score : '—'}</span>
    </div>
  );
}
