// 前台公开页：公告 + 三级筛选 + 赛程列表 + 排行榜（单项/总）。
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchGrades, fetchSports, fetchWeeks, fetchMatches,
  fetchSportRankings, fetchTotalRankings, fetchPublicSettings, fetchClasses,
  fetchSportIdsWithMatches,
} from '../lib/api';
import type { Grade, Sport, EnrichedMatch, SportRanking, TotalRanking, ClassRow } from '../lib/types';
import { GradeSportWeekFilter } from '../components/Filters';
import { Spinner, StatusBadge, ResultText } from '../components/ui';
import { MarkdownView } from '../components/Markdown';

// 单项排名的二级排序：积分 → 胜场 → 净胜分（此处无逐队净胜分，用胜-负近似）→ 少负场
function sortSport(a: SportRanking, b: SportRanking) {
  if (b.points !== a.points) return b.points - a.points;
  if (b.wins !== a.wins) return b.wins - a.wins;
  return a.losses - b.losses;
}

export default function HomePage() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [weeks, setWeeks] = useState<number[]>([]);
  const [gradeId, setGradeId] = useState<number | ''>('');
  const [sportId, setSportId] = useState<number | ''>('');
  const [week, setWeek] = useState<number | ''>('');
  const [matches, setMatches] = useState<EnrichedMatch[]>([]);
  const [gradeSports, setGradeSports] = useState<number[]>([]); // 当前年级下有比赛的项目
  const [announcement, setAnnouncement] = useState('');
  const [footer, setFooter] = useState('© 天津经济技术开发区第一中学 体育赛事管理系统');
  const [showTotal, setShowTotal] = useState(false);
  const [sportRank, setSportRank] = useState<SportRanking[]>([]);
  const [totalRank, setTotalRank] = useState<TotalRanking[]>([]);
  const [loading, setLoading] = useState(true);

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);
  // 项目下拉只显示当前年级下有比赛的项目
  const visibleSports = useMemo(
    () => sports.filter((s) => gradeSports.includes(s.id)),
    [sports, gradeSports],
  );

  // 初始化
  useEffect(() => {
    (async () => {
      try {
        const [g, s, c] = await Promise.all([fetchGrades(), fetchSports(), fetchClasses()]);
        setGrades(g); setSports(s); setClasses(c);
        if (g.length) setGradeId(g[0].id);
        // 项目选中由下方 effect 根据「该年级下有比赛的项目」自动决定
        fetchPublicSettings().then((d) => { setAnnouncement(d.content); if (d.footer) setFooter(d.footer); }).catch(() => {});
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 年级变化 → 载入该年级下有比赛的项目，并自动选中第一个
  useEffect(() => {
    if (!gradeId) return;
    fetchSportIdsWithMatches(gradeId).then((ids) => {
      setGradeSports(ids);
      setSportId((prev) => (prev && ids.includes(prev) ? prev : (ids.length ? ids[0] : '')));
    });
  }, [gradeId]);

  // 年级/项目变化 → 载入周次
  useEffect(() => {
    if (!gradeId || !sportId) return;
    fetchWeeks(gradeId, sportId).then((w) => {
      setWeeks(w);
      setWeek(w.length ? w[0] : '');
    });
  }, [gradeId, sportId]);

  // 筛选变化 → 载入比赛
  useEffect(() => {
    if (!gradeId || !sportId || week === '') { setMatches([]); return; }
    fetchMatches({ gradeId, sportId, week }).then(setMatches);
  }, [gradeId, sportId, week]);

  // 排行榜
  useEffect(() => {
    if (!gradeId) return;
    if (showTotal) fetchTotalRankings(gradeId).then(setTotalRank);
    else if (sportId) fetchSportRankings(gradeId, sportId).then(setSportRank);
    else setSportRank([]); // 该年级无比赛时清空，避免显示上一个年级的排名
  }, [gradeId, sportId, showTotal, matches]);

  if (loading) return <Spinner />;

  return (
    <div className="min-h-screen">
      <header className="bg-brand text-white shadow">
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between gap-3">
          <h1 className="text-lg sm:text-2xl font-bold leading-tight">
            天津经济技术开发区第一中学
          </h1>
          <Link to="/admin/login" className="text-sm opacity-80 hover:opacity-100 underline whitespace-nowrap">管理员</Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {announcement && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <MarkdownView source={announcement} />
          </div>
        )}

        <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <GradeSportWeekFilter
            grades={grades} sports={visibleSports} weeks={weeks}
            gradeId={gradeId} sportId={sportId} week={week}
            onGrade={(v) => { setGradeId(v); setSportId(''); }}
            onSport={setSportId} onWeek={setWeek}
          />
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <h2 className="px-4 py-3 font-semibold border-b border-slate-100">赛程</h2>
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
                  <th className="px-4 py-2 text-left">结果</th>
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
                    <td className="px-4 py-2">
                      <ResultText result={m.result} homeName={m.home_class_name} awayName={m.away_class_name} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold">排行榜</h2>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={showTotal} onChange={(e) => setShowTotal(e.target.checked)} />
              显示总排行榜
            </label>
          </div>
          {showTotal ? (
            <RankTable
              rows={[...totalRank].sort((a, b) => b.total_points - a.total_points)
                .map((r) => ({ name: classMap.get(r.class_id) ?? '?', cols: [r.total_points] }))}
              headers={['班级', '总积分']}
            />
          ) : (
            <RankTable
              rows={[...sportRank].sort(sortSport)
                .map((r) => ({ name: classMap.get(r.class_id) ?? '?', cols: [r.wins, r.losses, r.draws, r.points] }))}
              headers={['班级', '胜', '负', '平', '积分']}
            />
          )}
        </section>

        <footer className="text-center text-xs text-slate-400 py-6 whitespace-pre-line">
          {footer}
        </footer>
      </div>
    </div>
  );
}

function RankTable({ rows, headers }: { rows: { name: string; cols: number[] }[]; headers: string[] }) {
  if (!rows.length) return <p className="p-6 text-center text-slate-400 text-sm">暂无排名数据</p>;
  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50 text-slate-500">
        <tr>
          <th className="px-4 py-2 text-left w-12">#</th>
          {headers.map((h, i) => (
            <th key={h} className={`px-4 py-2 ${i === 0 ? 'text-left' : 'text-center'}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.name} className="border-t border-slate-50">
            <td className="px-4 py-2 text-slate-400">{i + 1}</td>
            <td className="px-4 py-2 font-medium">{r.name}</td>
            {r.cols.map((c, j) => (
              <td key={j} className={`px-4 py-2 text-center ${j === r.cols.length - 1 ? 'font-semibold text-brand' : ''}`}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
