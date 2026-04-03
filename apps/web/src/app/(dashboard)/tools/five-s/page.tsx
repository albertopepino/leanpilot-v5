'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import FileUpload from '@/components/FileUpload';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Plus, ClipboardCheck, ChevronLeft, CheckCircle, X, Star, Download, HelpCircle, TrendingUp } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState } from '@/components/ui/EmptyState';
import { exportToCSV } from '@/lib/csv-export';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';
import {
  Radar, RadarChart as RechartsRadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, Legend,
} from 'recharts';
import { Sparkline } from '@/components/ui/charts';

interface Workstation {
  id: string;
  name: string;
  area: string | null;
}

interface FiveSScore {
  id: string;
  category: string;
  score: number;
  notes: string | null;
  photoUrl: string | null;
}

interface FiveSAudit {
  id: string;
  area: string;
  status: 'in_progress' | 'completed';
  totalScore: number;
  percentage: number;
  notes: string | null;
  createdAt: string;
  auditor: { firstName: string; lastName: string };
  scores: FiveSScore[];
}

const CATEGORIES = [
  { key: 'sort', label: 'Sort (Seiri)', desc: 'Remove unnecessary items', emoji: '🗂️' },
  { key: 'set_in_order', label: 'Set in Order (Seiton)', desc: 'Organize remaining items', emoji: '📐' },
  { key: 'shine', label: 'Shine (Seiso)', desc: 'Clean the workspace', emoji: '✨' },
  { key: 'standardize', label: 'Standardize (Seiketsu)', desc: 'Create consistent processes', emoji: '📋' },
  { key: 'sustain', label: 'Sustain (Shitsuke)', desc: 'Maintain discipline', emoji: '🔄' },
  { key: 'safety', label: 'Safety', desc: 'Hazard identification & PPE', emoji: '🦺' },
];

// Scoring criteria per category — what each score 1-5 means
const SCORE_CRITERIA: Record<string, Record<number, string>> = {
  sort: {
    1: 'Unnecessary items everywhere, no red-tag process in place',
    2: 'Many unneeded items remain, red-tagging started but inconsistent',
    3: 'Most unnecessary items removed, some gray areas remain',
    4: 'Only needed items present, red-tag process followed regularly',
    5: 'Perfect: only essential items, regular audits, disposal process active',
  },
  set_in_order: {
    1: 'No designated locations, tools/parts scattered randomly',
    2: 'Some labeling exists but items frequently misplaced',
    3: 'Most items have designated spots, some labels missing or unclear',
    4: 'Clear labeling, shadow boards, items returned after use',
    5: 'Visual workplace: everything labeled, color-coded, 30-second retrieval',
  },
  shine: {
    1: 'Area is dirty, debris/spills present, safety hazard',
    2: 'Cleaning done sporadically, visible grime on equipment',
    3: 'Regular cleaning schedule exists, area generally clean',
    4: 'Clean and well-maintained, cleaning integrated into daily routine',
    5: 'Spotless: cleaning is inspection, root causes of dirt eliminated',
  },
  standardize: {
    1: 'No standards documented, each shift does things differently',
    2: 'Some written standards but not posted or followed consistently',
    3: 'Standards posted, most personnel aware, occasional deviations',
    4: 'Visual standards at point of use, regular checks, deviations flagged',
    5: 'Self-explaining workplace, standards continuously improved, full compliance',
  },
  sustain: {
    1: 'No audit schedule, 5S efforts abandoned after initial push',
    2: 'Occasional audits but no follow-up on findings',
    3: 'Regular audits with action plans, some areas backslide',
    4: 'Strong discipline, team ownership, improvements tracked on board',
    5: '5S is culture: self-audits, Kaizen suggestions, management walks the floor',
  },
  safety: {
    1: 'Unsafe conditions present, PPE not worn, hazards unaddressed',
    2: 'Major safety gaps: missing guards, poor signage, near-misses ignored',
    3: 'Basic PPE compliance, hazards marked, emergency exits clear',
    4: 'Good safety culture, regular hazard walks, near-miss reporting active',
    5: 'Zero-incident mindset: proactive hazard elimination, safety embedded in all tasks',
  },
};

const SCORE_LABELS: Record<number, string> = {
  1: 'Unacceptable',
  2: 'Poor',
  3: 'Fair',
  4: 'Good',
  5: 'Excellent',
};

// Tooltip component for score criteria
const ScoreCriteriaTooltip = ({ categoryKey }: { categoryKey: string }) => {
  const [open, setOpen] = useState(false);
  const criteria = SCORE_CRITERIA[categoryKey];
  if (!criteria) return null;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="p-0.5 text-gray-400 hover:text-brand-500 dark:text-gray-500 dark:hover:text-brand-400 transition-colors"
        aria-label="Scoring criteria"
      >
        <HelpCircle className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg text-xs">
          <div className="font-semibold text-gray-900 dark:text-white mb-2">Scoring Guide</div>
          <div className="space-y-1.5">
            {[1, 2, 3, 4, 5].map(score => (
              <div key={score} className="flex gap-2">
                <span className={`shrink-0 w-5 h-5 rounded flex items-center justify-center font-bold text-white ${
                  score === 1 ? 'bg-red-500' :
                  score === 2 ? 'bg-orange-500' :
                  score === 3 ? 'bg-yellow-500' :
                  score === 4 ? 'bg-green-500' :
                  'bg-emerald-600'
                }`}>
                  {score}
                </span>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">{SCORE_LABELS[score]}: </span>
                  <span className="text-gray-500 dark:text-gray-400">{criteria[score]}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 rotate-45 bg-white dark:bg-gray-800 border-r border-b border-gray-200 dark:border-gray-600" />
        </div>
      )}
    </div>
  );
};

// ── 5S Trends types ────────────────────────────────────────────
interface FiveSCategoryScore {
  sort: number;
  set_in_order: number;
  shine: number;
  standardize: number;
  sustain: number;
  safety: number;
}

interface FiveSAreaScore {
  area: string;
  latestPercentage: number;
  latestDate: string;
}

interface FiveSTrendsResponse {
  insufficientData?: boolean;
  currentScores?: FiveSCategoryScore;
  previousScores?: FiveSCategoryScore;
  areaScores?: FiveSAreaScore[];
  monthlyTotals?: { month: string; percentage: number }[];
}

const RADAR_LABELS: Record<string, string> = {
  sort: 'Sort',
  set_in_order: 'Set in Order',
  shine: 'Shine',
  standardize: 'Standardize',
  sustain: 'Sustain',
  safety: 'Safety',
};

function FiveSTrendsSection() {
  const [trends, setTrends] = useState<FiveSTrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<FiveSTrendsResponse>('/tools/five-s/trends?months=6')
      .then(data => setTrends(data))
      .catch(() => setTrends(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="h-48 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-brand-600 rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  if (!trends || trends.insufficientData) {
    return (
      <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="text-center py-6">
          <TrendingUp className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Complete 3 more audits to unlock trend analytics.
          </p>
        </div>
      </div>
    );
  }

  // Build radar chart data
  const radarData = Object.keys(RADAR_LABELS).map(key => ({
    category: RADAR_LABELS[key],
    current: trends.currentScores?.[key as keyof FiveSCategoryScore] ?? 0,
    previous: trends.previousScores?.[key as keyof FiveSCategoryScore] ?? 0,
  }));

  const areas = trends.areaScores || [];
  const monthly = trends.monthlyTotals || [];

  return (
    <div className="mb-6 space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        {/* Radar chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="font-medium text-gray-900 dark:text-white mb-4 text-center">Current vs Previous Audit</h3>
          <ResponsiveContainer width="100%" height={280}>
            <RechartsRadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="category" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <Radar name="Current" dataKey="current" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} strokeWidth={2} />
              <Radar name="Previous" dataKey="previous" stroke="#9ca3af" fill="#9ca3af" fillOpacity={0.1} strokeWidth={1.5} />
              <Tooltip
                contentStyle={{
                  background: 'rgba(255,255,255,0.95)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  fontSize: '13px',
                }}
              />
              <Legend />
            </RechartsRadarChart>
          </ResponsiveContainer>
        </div>

        {/* Area comparison + sparkline */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="font-medium text-gray-900 dark:text-white mb-4">Area Scores</h3>
          {areas.length > 0 ? (
            <div className="space-y-3">
              {areas.map(area => {
                const pct = area.latestPercentage;
                const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500';
                return (
                  <div key={area.area}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{area.area}</span>
                      <span className={`text-sm font-mono font-bold ${
                        pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-600'
                      }`}>{pct}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(area.latestDate).toLocaleDateString()}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">No area data available</p>
          )}

          {/* Sparkline trend */}
          {monthly.length > 1 && (
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                6-Month Trend
              </h4>
              <Sparkline data={monthly.map(m => m.percentage)} color="#3b82f6" height={48} />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>{monthly[0]?.month}</span>
                <span>{monthly[monthly.length - 1]?.month}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type View = 'list' | 'create' | 'detail' | 'scoring';

export default function FiveSPage() {
  const [audits, setAudits] = useState<FiveSAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('list');
  const [selected, setSelected] = useState<FiveSAudit | null>(null);
  const [error, setError] = useState('');
  const { toast } = useToast();

  // Workstations for dropdown
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [wsLoaded, setWsLoaded] = useState(false);

  // Create form
  const [newArea, setNewArea] = useState('');
  const [customArea, setCustomArea] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [creating, setCreating] = useState(false);

  // Scoring state
  const [scores, setScores] = useState<Record<string, number>>({});
  const [scoreNotes, setScoreNotes] = useState<Record<string, string>>({});
  const [scorePhotos, setScorePhotos] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showConfirmComplete, setShowConfirmComplete] = useState(false);

  const loadAudits = useCallback(() => {
    api.get<FiveSAudit[]>('/tools/five-s')
      .then(data => setAudits(Array.isArray(data) ? data : []))
      .catch(() => setAudits([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadAudits(); }, [loadAudits]);

  // Load workstations for area dropdown
  const [wsFailed, setWsFailed] = useState(false);
  useEffect(() => {
    api.get<Workstation[]>('/workstations')
      .then(data => { setWorkstations(Array.isArray(data) ? data : []); setWsFailed(false); })
      .catch(() => { setWorkstations([]); setWsFailed(true); })
      .finally(() => setWsLoaded(true));
  }, []);

  const resolvedArea = newArea === '__custom__' ? customArea.trim() : newArea;

  const createAudit = async () => {
    if (!resolvedArea) return;
    setCreating(true);
    setError('');
    try {
      const audit = await api.post<FiveSAudit>('/tools/five-s', {
        area: resolvedArea,
        notes: newNotes.trim() || undefined,
      });
      setAudits(prev => [audit, ...prev]);
      setSelected(audit);
      // Pre-fill scores
      const s: Record<string, number> = {};
      const n: Record<string, string> = {};
      const p: Record<string, string> = {};
      (audit.scores || []).forEach(sc => {
        s[sc.category] = sc.score;
        n[sc.category] = sc.notes || '';
        if (sc.photoUrl) p[sc.category] = sc.photoUrl;
      });
      CATEGORIES.forEach(c => { if (s[c.key] === undefined) s[c.key] = 0; });
      setScores(s);
      setScoreNotes(n);
      setScorePhotos(p);
      setView('scoring');
      setNewArea('');
      setCustomArea('');
      setNewNotes('');
      toast('success', 'Audit created — start scoring');
    } catch (e: any) {
      setError(e.message || 'Failed to create audit');
    } finally {
      setCreating(false);
    }
  };

  const openDetail = (audit: FiveSAudit) => {
    setSelected(audit);
    // Load full detail
    api.get<FiveSAudit>(`/tools/five-s/${audit.id}`)
      .then(full => {
        setSelected(full);
        const s: Record<string, number> = {};
        const n: Record<string, string> = {};
        const p: Record<string, string> = {};
        (full.scores || []).forEach(sc => {
          s[sc.category] = sc.score;
          n[sc.category] = sc.notes || '';
          if (sc.photoUrl) p[sc.category] = sc.photoUrl;
        });
        CATEGORIES.forEach(c => { if (s[c.key] === undefined) s[c.key] = 0; });
        setScores(s);
        setScoreNotes(n);
        setScorePhotos(p);
      })
      .catch(() => {});
    setView('detail');
  };

  const saveScores = async () => {
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      const payload = CATEGORIES.map(c => ({
        category: c.key,
        score: scores[c.key] || 0,
        notes: scoreNotes[c.key] || undefined,
        photoUrl: scorePhotos[c.key] || undefined,
      }));
      const updated = await api.patch<FiveSAudit>(`/tools/five-s/${selected.id}/scores`, { scores: payload });
      setSelected(updated);
      setAudits(prev => prev.map(a => a.id === updated.id ? updated : a));
      toast('success', 'Scores saved');
    } catch (e: any) {
      setError(e.message || 'Failed to save scores');
    } finally {
      setSaving(false);
    }
  };

  const completeAudit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await api.patch<FiveSAudit>(`/tools/five-s/${selected.id}/complete`, {});
      setSelected(updated);
      setAudits(prev => prev.map(a => a.id === updated.id ? updated : a));
      setView('detail');
    } catch (e: any) {
      setError(e.message || 'Failed to complete audit');
    } finally {
      setSaving(false);
    }
  };

  // Simple radar chart as SVG
  const RadarChart = ({ auditScores }: { auditScores: FiveSScore[] }) => {
    const size = 200;
    const cx = size / 2;
    const cy = size / 2;
    const maxR = 80;
    const cats = CATEGORIES.map(c => ({
      ...c,
      score: auditScores.find(s => s.category === c.key)?.score || 0,
    }));
    const n = cats.length;
    const getPoint = (i: number, val: number) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const r = (val / 5) * maxR;
      return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    };
    const gridLevels = [1, 2, 3, 4, 5];
    const dataPoints = cats.map((c, i) => getPoint(i, c.score));
    const polygon = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

    return (
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[280px] mx-auto">
        {/* Grid */}
        {gridLevels.map(level => {
          const pts = Array.from({ length: n }, (_, i) => getPoint(i, level));
          return (
            <polygon
              key={level}
              points={pts.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="currentColor"
              className="text-gray-200 dark:text-gray-700"
              strokeWidth={level === 5 ? 1.5 : 0.5}
            />
          );
        })}
        {/* Axes */}
        {cats.map((_, i) => {
          const p = getPoint(i, 5);
          return (
            <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y}
              stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth={0.5}
            />
          );
        })}
        {/* Data polygon */}
        <polygon points={polygon} fill="rgba(59,130,246,0.2)" stroke="#3b82f6" strokeWidth={2} />
        {/* Data dots */}
        {dataPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="#3b82f6" />
        ))}
        {/* Labels */}
        {cats.map((c, i) => {
          const p = getPoint(i, 6.2);
          return (
            <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
              className="fill-gray-600 dark:fill-gray-400 text-[8px]"
            >
              {c.emoji}
            </text>
          );
        })}
      </svg>
    );
  };

  // Score selector (0-5 stars)
  const ScoreInput = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(v => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v === value ? 0 : v)}
          className="p-0.5 transition-colors"
          aria-label={`Score ${v}`}
        >
          <Star className={`w-6 h-6 ${v <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`} />
        </button>
      ))}
      <span className="ml-2 text-sm font-mono text-gray-500 dark:text-gray-400 self-center">{value}/5</span>
    </div>
  );

  // ===== LIST VIEW =====
  if (view === 'list') {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">5S / 6S Audit</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Workplace organization audits — Sort, Set in Order, Shine, Standardize, Sustain, Safety
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportToCSV(audits.map(a => ({
                Area: a.area,
                Status: a.status,
                'Score %': a.percentage,
                'Total Score': a.totalScore,
                Auditor: `${a.auditor.firstName} ${a.auditor.lastName}`,
                Date: new Date(a.createdAt).toLocaleDateString(),
              })), '5s-audits')}
              disabled={audits.length === 0}
              className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-40"
              title="Export CSV"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('create')}
              className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Audit
            </button>
          </div>
        </div>

        {/* Trends section */}
        {!loading && audits.length > 0 && <FiveSTrendsSection />}

        {loading ? (
          <SkeletonList count={3} />
        ) : audits.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="No audits yet"
            description="Start your first 5S audit to assess workplace organization."
            actionLabel="New Audit"
            onAction={() => setView('create')}
          />
        ) : (
          <div className="grid gap-3">
            {audits.map(audit => (
              <Card key={audit.id} onClick={() => openDetail(audit)}>
                <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">{audit.area}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {audit.auditor?.firstName} {audit.auditor?.lastName} — {new Date(audit.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {audit.status === 'completed' && (
                    <span className={`text-lg font-bold ${
                      audit.percentage >= 80 ? 'text-green-600' :
                      audit.percentage >= 60 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {audit.percentage}%
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    audit.status === 'completed'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {audit.status === 'completed' ? 'Completed' : 'In Progress'}
                  </span>
                </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ===== CREATE VIEW =====
  if (view === 'create') {
    return (
      <div>
        <Breadcrumb items={[
          { label: '5S Audits', onClick: () => setView('list') },
          { label: 'New Audit' },
        ]} />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">New 5S Audit</h1>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-lg">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
              <span className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</span>
              <button onClick={() => setError('')} aria-label="Dismiss error"><X className="w-4 h-4 text-red-400" /></button>
            </div>
          )}
          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Area / Zone *</span>
            <select
              value={newArea}
              onChange={e => setNewArea(e.target.value)}
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            >
              <option value="">{wsFailed ? 'Workstations unavailable — use custom' : 'Select workstation or area...'}</option>
              {workstations.map(ws => (
                <option key={ws.id} value={ws.name}>
                  {ws.name}{ws.area ? ` (${ws.area})` : ''}
                </option>
              ))}
              <option value="__custom__">Custom location...</option>
            </select>
          </label>
          {newArea === '__custom__' && (
            <label className="block mb-4">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Custom Location *</span>
              <input
                type="text"
                value={customArea}
                onChange={e => setCustomArea(e.target.value)}
                placeholder="e.g. Warehouse Bay C, Loading Dock"
                className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </label>
          )}
          <label className="block mb-6">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Notes (optional)</span>
            <textarea
              value={newNotes}
              onChange={e => setNewNotes(e.target.value)}
              rows={3}
              placeholder="Audit context, focus areas..."
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </label>
          <button
            onClick={createAudit}
            disabled={creating || !resolvedArea}
            className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {creating ? 'Creating...' : 'Start Audit & Score'}
          </button>
        </div>
      </div>
    );
  }

  // ===== SCORING VIEW =====
  if (view === 'scoring' && selected) {
    const total = CATEGORIES.reduce((s, c) => s + (scores[c.key] || 0), 0);
    const maxTotal = CATEGORIES.length * 5;
    const pct = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;

    return (
      <div>
        <Breadcrumb items={[
          { label: '5S Audits', onClick: () => { setView('list'); setSelected(null); } },
          { label: selected.area, onClick: () => setView('detail') },
          { label: 'Scoring' },
        ]} />
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Score: {selected.area}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Rate each category 0-5 stars</p>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
              {pct}%
            </div>
            <div className="text-xs text-gray-400">{total}/{maxTotal}</div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
            <span className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</span>
            <button onClick={() => setError('')} aria-label="Dismiss error"><X className="w-4 h-4 text-red-400" /></button>
          </div>
        )}

        <div className="space-y-4 mb-6">
          {CATEGORIES.map(cat => (
            <div key={cat.key} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-1">
                    {cat.emoji} {cat.label}
                    <ScoreCriteriaTooltip categoryKey={cat.key} />
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{cat.desc}</p>
                </div>
                <ScoreInput value={scores[cat.key] || 0} onChange={v => setScores(p => ({ ...p, [cat.key]: v }))} />
              </div>
              <input
                type="text"
                value={scoreNotes[cat.key] || ''}
                onChange={e => setScoreNotes(p => ({ ...p, [cat.key]: e.target.value }))}
                placeholder="Notes for this category..."
                className="w-full px-3 py-1.5 rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-sm text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-brand-500"
              />
              <div className="mt-2">
                <FileUpload
                  func="five-s"
                  label="Photo evidence"
                  compact
                  value={scorePhotos[cat.key]}
                  onUpload={(url) => setScorePhotos(p => ({ ...p, [cat.key]: url }))}
                  onClear={() => setScorePhotos(p => { const copy = { ...p }; delete copy[cat.key]; return copy; })}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={saveScores}
            disabled={saving}
            className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? 'Saving...' : 'Save Scores'}
          </button>
          {selected.status !== 'completed' && (<>
            <button
              onClick={() => {
                setShowConfirmComplete(true);
              }}
              disabled={saving || total === 0}
              className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save & Complete'}
            </button>
            <ConfirmDialog
              open={showConfirmComplete}
              title="Complete 5S Audit"
              message="This will finalize and lock the audit. Scores cannot be changed after completion. Continue?"
              confirmLabel="Complete Audit"
              variant="warning"
              loading={saving}
              onConfirm={async () => {
                setSaving(true);
                try { await saveScores(); await completeAudit(); } catch {} finally { setSaving(false); setShowConfirmComplete(false); }
              }}
              onCancel={() => { setSaving(false); setShowConfirmComplete(false); }}
            />
          </>)}
        </div>
      </div>
    );
  }

  // ===== DETAIL VIEW =====
  if (view === 'detail' && selected) {
    return (
      <div>
        <Breadcrumb items={[
          { label: '5S Audits', onClick: () => { setView('list'); setSelected(null); } },
          { label: selected.area },
        ]} />
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{selected.area}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              {selected.auditor?.firstName} {selected.auditor?.lastName} — {new Date(selected.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              selected.status === 'completed'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
            }`}>
              {selected.status === 'completed' ? 'Completed' : 'In Progress'}
            </span>
            <button
              onClick={() => api.downloadPdf(`/reports/five-s/${selected.id}`, `5s-audit-${selected.area}.pdf`).catch(() => toast('error', 'Failed to export PDF'))}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Download className="w-4 h-4" /> Export PDF
            </button>
            {selected.status !== 'completed' && (
              <button
                onClick={() => setView('scoring')}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Edit Scores
              </button>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Radar Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-medium text-gray-900 dark:text-white mb-4 text-center">Radar Overview</h3>
            <RadarChart auditScores={selected.scores || []} />
            <div className="text-center mt-3">
              <span className={`text-3xl font-bold ${
                selected.percentage >= 80 ? 'text-green-600' :
                selected.percentage >= 60 ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {selected.percentage}%
              </span>
              <span className="text-gray-400 text-sm ml-2">({selected.totalScore}/{CATEGORIES.length * 5})</span>
            </div>
          </div>

          {/* Category breakdown */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-medium text-gray-900 dark:text-white mb-4">Category Scores</h3>
            <div className="space-y-3">
              {CATEGORIES.map(cat => {
                const sc = (selected.scores || []).find(s => s.category === cat.key);
                const val = sc?.score || 0;
                return (
                  <div key={cat.key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{cat.emoji} {cat.label}</span>
                      <span className="text-sm font-mono font-medium text-gray-900 dark:text-white">{val}/5</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          val >= 4 ? 'bg-green-500' : val >= 3 ? 'bg-yellow-500' : val >= 1 ? 'bg-red-500' : 'bg-gray-300'
                        }`}
                        style={{ width: `${(val / 5) * 100}%` }}
                      />
                    </div>
                    {sc?.notes && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">{sc.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {selected.notes && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">Audit Notes</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{selected.notes}</p>
          </div>
        )}
      </div>
    );
  }

  // Fallback — should never reach here
  return null;
}
