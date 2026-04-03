'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import FileUpload from '@/components/FileUpload';
import {
  Eye, Plus, CheckCircle2, Clock, ChevronRight, X, Send,
  AlertTriangle, Loader2, ArrowLeft, Download, Calendar, UserIcon, ClipboardList,
  TrendingUp, BarChart3,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';
import { exportToCSV } from '@/lib/csv-export';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts';

// ── Types ──────────────────────────────────────────────────────────────

interface GembaWalk {
  id: string;
  date: string;
  startedAt: string;
  endedAt?: string;
  status: string;
  walker: { firstName: string; lastName: string };
  _count: { observations: number };
}

interface GembaWalkDetail {
  id: string;
  date: string;
  status: string;
  walker: { firstName: string; lastName: string };
  observations: Observation[];
}

interface Observation {
  id: string;
  wasteCategory: string;
  severity: string;
  description: string;
  photoUrl?: string;
  operatorQuote?: string;
  status: string;
  actionRequired?: string;
  assignedTo?: { id: string; firstName: string; lastName: string } | null;
  dueDate?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface Workstation {
  id: string;
  name: string;
  code: string;
}

// ── Constants ──────────────────────────────────────────────────────────

const WASTE_CATEGORIES = [
  { value: 'waiting',         label: 'Waiting',         emoji: '⏳' },
  { value: 'overproduction',  label: 'Overproduction',  emoji: '📦' },
  { value: 'inventory',       label: 'Excess Inventory',emoji: '🏗️' },
  { value: 'motion',          label: 'Motion',          emoji: '🚶' },
  { value: 'transportation',  label: 'Transportation',  emoji: '🚛' },
  { value: 'over_processing', label: 'Over-processing', emoji: '⚙️' },
  { value: 'defect',          label: 'Defects',         emoji: '❌' },
  { value: 'talent',          label: 'Unused Talent',   emoji: '🧠' },
];

const SEVERITY_BADGE: Record<string, string> = {
  high:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  low:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const OBS_STATUSES = ['open', 'investigating', 'addressed', 'closed'] as const;

const STATUS_BADGE: Record<string, string> = {
  open:          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  investigating: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  addressed:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  closed:        'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

// ── Waste Pareto types ─────────────────────────────────────────
interface WasteCount {
  category: string;
  count: number;
  label: string;
}

interface AreaHeatmapRow {
  area: string;
  count: number;
}

interface WasteParetoResponse {
  insufficientData?: boolean;
  wasteCounts?: WasteCount[];
  areaHeatmap?: AreaHeatmapRow[];
}

const WASTE_LABELS: Record<string, string> = {
  waiting: 'Waiting',
  overproduction: 'Overproduction',
  inventory: 'Inventory',
  motion: 'Motion',
  transportation: 'Transportation',
  over_processing: 'Over-processing',
  defect: 'Defect',
  talent: 'Talent',
};

const WASTE_COLORS: Record<string, string> = {
  waiting: '#f59e0b',
  overproduction: '#ef4444',
  inventory: '#6366f1',
  motion: '#3b82f6',
  transportation: '#06b6d4',
  over_processing: '#8b5cf6',
  defect: '#f43f5e',
  talent: '#10b981',
};

function WasteParetoSection() {
  const [data, setData] = useState<WasteParetoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    api.get<WasteParetoResponse>('/gemba/waste-pareto?months=3')
      .then(d => setData(d))
      .catch(() => setData(null))
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

  if (!data || data.insufficientData) {
    return (
      <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="text-center py-6">
          <BarChart3 className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Complete more Gemba walks to see waste analysis.
          </p>
        </div>
      </div>
    );
  }

  const wastes = (data.wasteCounts || []).sort((a, b) => b.count - a.count);
  const totalCount = wastes.reduce((s, w) => s + w.count, 0);

  // Build pareto data with cumulative %
  let cumulative = 0;
  const paretoData = wastes.map(w => {
    cumulative += w.count;
    return {
      name: WASTE_LABELS[w.category] || w.label || w.category,
      count: w.count,
      cumulative: totalCount > 0 ? (cumulative / totalCount) * 100 : 0,
      fill: WASTE_COLORS[w.category] || '#6b7280',
    };
  });

  const areas = data.areaHeatmap || [];
  const maxAreaCount = Math.max(...areas.map(a => a.count), 1);

  return (
    <div className="mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-brand-600" />
          <span className="font-medium text-gray-900 dark:text-white">Waste Analysis (Last 3 Months)</span>
          <span className="text-xs text-gray-400">{totalCount} observations</span>
        </div>
        <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="mt-2 space-y-4">
          {/* Pareto chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-medium text-gray-900 dark:text-white mb-4">Waste Pareto Chart</h3>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={paretoData} margin={{ top: 8, right: 30, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  angle={-30}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  yAxisId="left"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  allowDecimals={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(255,255,255,0.95)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    fontSize: '13px',
                  }}
                  formatter={(val: number, name: string) => {
                    if (name === 'Cumulative %') return [`${val.toFixed(1)}%`, name];
                    return [val, name];
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="count" fill="#3b82f6" name="Count" radius={[4, 4, 0, 0]} barSize={32}>
                  {paretoData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
                <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="Cumulative %" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Area heatmap */}
          {areas.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="font-medium text-gray-900 dark:text-white mb-4">Observations by Area</h3>
              <div className="space-y-2">
                {areas.sort((a, b) => b.count - a.count).map(area => {
                  const intensity = area.count / maxAreaCount;
                  const bgOpacity = Math.max(0.1, intensity);
                  return (
                    <div key={area.area} className="flex items-center gap-3">
                      <span className="text-sm text-gray-700 dark:text-gray-300 w-32 truncate shrink-0">{area.area}</span>
                      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-6 relative overflow-hidden">
                        <div
                          className="h-6 rounded-full transition-all"
                          style={{
                            width: `${(area.count / maxAreaCount) * 100}%`,
                            backgroundColor: `rgba(239, 68, 68, ${bgOpacity})`,
                          }}
                        />
                        <span className="absolute inset-y-0 left-2 flex items-center text-xs font-medium text-gray-700 dark:text-gray-200">
                          {area.count}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type View = 'list' | 'detail' | 'add-obs' | 'obs-detail';

// ── Page ───────────────────────────────────────────────────────────────

export default function GembaPage() {
  const [walks, setWalks] = useState<GembaWalk[]>([]);
  const [selectedWalk, setSelectedWalk] = useState<GembaWalkDetail | null>(null);
  const [selectedObs, setSelectedObs] = useState<Observation | null>(null);
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [view, setView] = useState<View>('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Observation form
  const [obsWs, setObsWs] = useState('');
  const [obsCategory, setObsCategory] = useState('');
  const [obsSeverity, setObsSeverity] = useState('medium');
  const [obsDesc, setObsDesc] = useState('');
  const [obsPhoto, setObsPhoto] = useState('');
  const [obsQuote, setObsQuote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // PDCA follow-up state
  const [users, setUsers] = useState<UserOption[]>([]);
  const [pdcaAction, setPdcaAction] = useState('');
  const [pdcaAssignee, setPdcaAssignee] = useState('');
  const [pdcaDueDate, setPdcaDueDate] = useState('');
  const [pdcaSaving, setPdcaSaving] = useState(false);

  const loadWalks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<GembaWalk[]>('/gemba');
      setWalks(Array.isArray(res) ? res : res?.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWalks();
    api.get<Workstation[]>('/workstations').then(ws => setWorkstations(Array.isArray(ws) ? ws : ws?.data || [])).catch(() => {});
    api.get<UserOption[]>('/users').then(u => setUsers(Array.isArray(u) ? u : u?.data || [])).catch(() => {});
  }, [loadWalks]);

  const openWalk = async (id: string) => {
    try {
      setLoading(true);
      const detail = await api.get<GembaWalkDetail>(`/gemba/${id}`);
      setSelectedWalk(detail);
      setView('detail');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const startNewWalk = async () => {
    try {
      setLoading(true);
      const walk = await api.post<GembaWalk>('/gemba');
      await openWalk(walk.id);
      await loadWalks();
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const completeWalk = async () => {
    if (!selectedWalk) return;
    try {
      await api.patch(`/gemba/${selectedWalk.id}/complete`);
      setView('list');
      setSelectedWalk(null);
      await loadWalks();
      toast('success', 'Gemba walk completed');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const submitObservation = async () => {
    if (!selectedWalk || !obsCategory || !obsDesc.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/gemba/${selectedWalk.id}/observations`, {
        wasteCategory: obsCategory,
        severity: obsSeverity,
        description: obsDesc,
        ...(obsWs ? { workstationId: obsWs } : {}),
        ...(obsPhoto ? { photoUrl: obsPhoto } : {}),
        ...(obsQuote.trim() ? { operatorQuote: obsQuote } : {}),
      });
      // Reset form
      setObsCategory('');
      setObsDesc('');
      setObsPhoto('');
      setObsQuote('');
      setObsWs('');
      // Go back to detail view and refresh
      setView('detail');
      await openWalk(selectedWalk.id);
      toast('success', 'Observation recorded');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const updateObsStatus = async (obsId: string, status: string) => {
    try {
      await api.patch(`/gemba/observations/${obsId}/status`, { status });
      // Refresh walk detail to get updated observation
      if (selectedWalk) {
        const detail = await api.get<GembaWalkDetail>(`/gemba/${selectedWalk.id}`);
        setSelectedWalk(detail);
        // Update selectedObs with fresh data
        const updated = detail.observations.find(o => o.id === obsId);
        if (updated) setSelectedObs(updated);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const savePdca = async (obsId: string) => {
    setPdcaSaving(true);
    try {
      await api.patch(`/gemba/observations/${obsId}/pdca`, {
        actionRequired: pdcaAction.trim() || undefined,
        assignedToId: pdcaAssignee || undefined,
        dueDate: pdcaDueDate || undefined,
      });
      // Refresh walk detail
      if (selectedWalk) {
        const detail = await api.get<GembaWalkDetail>(`/gemba/${selectedWalk.id}`);
        setSelectedWalk(detail);
        const updated = detail.observations.find(o => o.id === obsId);
        if (updated) setSelectedObs(updated);
      }
      toast('success', 'Action plan saved');
    } catch (e: any) {
      toast('error', e.message || 'Failed to save action plan');
    } finally {
      setPdcaSaving(false);
    }
  };

  const markPdcaComplete = async (obsId: string) => {
    try {
      await api.patch(`/gemba/observations/${obsId}/pdca`, {
        completedAt: new Date().toISOString(),
      });
      if (selectedWalk) {
        const detail = await api.get<GembaWalkDetail>(`/gemba/${selectedWalk.id}`);
        setSelectedWalk(detail);
        const updated = detail.observations.find(o => o.id === obsId);
        if (updated) setSelectedObs(updated);
      }
      toast('success', 'Action marked complete');
    } catch (e: any) {
      toast('error', e.message || 'Failed to mark complete');
    }
  };

  // Count overdue actions across all observations in current walk
  const overdueActionCount = selectedWalk?.observations.filter(obs =>
    obs.dueDate && !obs.completedAt && new Date(obs.dueDate) < new Date()
  ).length || 0;

  const goBack = () => {
    if (view === 'obs-detail') { setView('detail'); setSelectedObs(null); return; }
    if (view === 'add-obs') { setView('detail'); return; }
    if (view === 'detail') { setView('list'); setSelectedWalk(null); return; }
  };

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div>
      {/* Breadcrumb */}
      {view !== 'list' && (
        <Breadcrumb items={[
          { label: 'Gemba Walk', onClick: () => { setView('list'); setSelectedWalk(null); setSelectedObs(null); } },
          ...(view === 'detail' || view === 'add-obs' || view === 'obs-detail'
            ? [{ label: selectedWalk?.date || 'Walk', onClick: view !== 'detail' ? () => { setView('detail'); setSelectedObs(null); } : undefined }]
            : []),
          ...(view === 'add-obs' ? [{ label: 'Add Observation' }] : []),
          ...(view === 'obs-detail' ? [{ label: 'Observation Detail' }] : []),
        ]} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Eye className="w-6 h-6 text-brand-600" />
            {view === 'list' ? 'Gemba Walk' : view === 'detail' ? `Walk — ${selectedWalk?.date}` : view === 'add-obs' ? 'Add Observation' : 'Observation Detail'}
          </h1>
          {view === 'list' && (
            <p className="text-sm text-gray-500 dark:text-gray-400">Go see, ask why, show respect</p>
          )}
        </div>
        {view === 'list' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportToCSV(walks.map(w => ({
                Date: w.date,
                Walker: `${w.walker.firstName} ${w.walker.lastName}`,
                Status: w.status,
                Observations: w._count.observations,
              })), 'gemba-walks')}
              disabled={walks.length === 0}
              className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-40"
              title="Export CSV"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={startNewWalk}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium text-sm disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Start Walk
            </button>
          </div>
        )}
        {view === 'detail' && selectedWalk && (
          <div className="flex gap-2">
            <button
              onClick={() => api.downloadPdf(`/reports/gemba/${selectedWalk.id}`, `gemba-walk-${selectedWalk.date}.pdf`).catch(() => toast('error', 'Failed to export PDF'))}
              className="flex items-center gap-1.5 px-3 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Download className="w-4 h-4" /> Export PDF
            </button>
            {selectedWalk.status === 'in_progress' && (
              <>
                <button
                  onClick={() => setView('add-obs')}
                  className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium text-sm"
                >
                  <Plus className="w-4 h-4" /> Add Observation
                </button>
                <button
                  onClick={completeWalk}
                  className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
                >
                  <CheckCircle2 className="w-4 h-4" /> Complete
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between">
          <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
          <button onClick={() => setError('')} aria-label="Dismiss error"><X className="w-4 h-4 text-red-400" /></button>
        </div>
      )}

      {loading && <SkeletonList count={3} />}

      {/* ── Waste Pareto (list view only) ─────────────────────────── */}
      {view === 'list' && !loading && walks.length > 0 && (
        <WasteParetoSection />
      )}

      {/* ── Walk List ─────────────────────────────────────────────── */}
      {view === 'list' && !loading && (
        <div className="space-y-2">
          {walks.length === 0 ? (
            <EmptyState
              icon={Eye}
              title="No Gemba walks yet"
              description="Go to the shop floor, observe processes, and document improvement opportunities."
              actionLabel="Start Walk"
              onAction={startNewWalk}
            />
          ) : (
            walks.map(walk => (
              <Card key={walk.id} onClick={() => openWalk(walk.id)} padding="sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      walk.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
                    }`}>
                      {walk.status === 'completed'
                        ? <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                        : <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      }
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{walk.date}</div>
                      <div className="text-sm text-gray-500">
                        {walk.walker.firstName} {walk.walker.lastName} · {walk._count.observations} observation{walk._count.observations !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ── Walk Detail ───────────────────────────────────────────── */}
      {view === 'detail' && selectedWalk && !loading && (
        <div className="space-y-3">
          {/* Overdue actions alert */}
          {overdueActionCount > 0 && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-sm text-red-700 dark:text-red-400 font-medium">
                {overdueActionCount} overdue action{overdueActionCount !== 1 ? 's' : ''} need attention
              </span>
            </div>
          )}

          {selectedWalk.observations.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500">No observations yet. Add your first one!</p>
            </div>
          ) : (
            selectedWalk.observations.map(obs => (
              <button
                key={obs.id}
                onClick={() => {
                  setSelectedObs(obs);
                  setPdcaAction(obs.actionRequired || '');
                  setPdcaAssignee(obs.assignedTo?.id || '');
                  setPdcaDueDate(obs.dueDate ? obs.dueDate.split('T')[0] : '');
                  setView('obs-detail');
                }}
                className="w-full p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors text-left"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${SEVERITY_BADGE[obs.severity] || SEVERITY_BADGE.medium}`}>
                    {obs.severity}
                  </span>
                  <span className="text-sm text-gray-500">
                    {WASTE_CATEGORIES.find(w => w.value === obs.wasteCategory)?.emoji}{' '}
                    {WASTE_CATEGORIES.find(w => w.value === obs.wasteCategory)?.label || obs.wasteCategory}
                  </span>
                  <span className={`ml-auto px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_BADGE[obs.status] || STATUS_BADGE.open}`}>
                    {obs.status}
                  </span>
                </div>
                <p className="text-sm text-gray-900 dark:text-white">{obs.description}</p>
                {obs.operatorQuote && (
                  <p className="text-sm text-gray-500 italic mt-1">&ldquo;{obs.operatorQuote}&rdquo;</p>
                )}
                {/* PDCA indicators */}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    {obs.actionRequired && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <ClipboardList className="w-3 h-3" /> Action set
                      </span>
                    )}
                    {obs.dueDate && !obs.completedAt && new Date(obs.dueDate) < new Date() && (
                      <span className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Overdue
                      </span>
                    )}
                    {obs.completedAt && (
                      <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Done
                      </span>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* ── Add Observation Form ──────────────────────────────────── */}
      {view === 'add-obs' && (
        <div className="space-y-4 max-w-xl">
          {/* Waste Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Waste Category *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {WASTE_CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => setObsCategory(cat.value)}
                  className={`p-3 rounded-lg text-left text-sm transition-colors border ${
                    obsCategory === cat.value
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <span className="mr-2">{cat.emoji}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Severity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Severity</label>
            <div className="flex gap-2">
              {['low', 'medium', 'high'].map(s => (
                <button
                  key={s}
                  onClick={() => setObsSeverity(s)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium capitalize transition-colors border ${
                    obsSeverity === s
                      ? s === 'high' ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                        : s === 'medium' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
                        : 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Workstation (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Workstation (optional)</label>
            <select
              value={obsWs}
              onChange={e => setObsWs(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            >
              <option value="">— None —</option>
              {workstations.map(ws => (
                <option key={ws.id} value={ws.id}>{ws.code} — {ws.name}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description *</label>
            <textarea
              value={obsDesc}
              onChange={e => setObsDesc(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none"
              rows={3}
              placeholder="What did you observe?"
            />
          </div>

          {/* Photo URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Photo (optional)</label>
            <FileUpload
              func="gemba"
              label="Upload photo"
              value={obsPhoto}
              onUpload={(url) => setObsPhoto(url)}
              onClear={() => setObsPhoto('')}
            />
          </div>

          {/* Operator Quote */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Operator Quote (optional)</label>
            <input
              type="text"
              value={obsQuote}
              onChange={e => setObsQuote(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              placeholder="What did the operator say?"
            />
          </div>

          {/* Submit */}
          <button
            onClick={submitObservation}
            disabled={!obsCategory || !obsDesc.trim() || submitting}
            className="w-full flex items-center justify-center gap-2 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium disabled:opacity-50 transition-colors"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Save Observation
          </button>
        </div>
      )}

      {/* ── Observation Detail ────────────────────────────────────── */}
      {view === 'obs-detail' && selectedObs && (
        <div className="max-w-xl space-y-4">
          {/* Header card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${SEVERITY_BADGE[selectedObs.severity] || SEVERITY_BADGE.medium}`}>
                {selectedObs.severity}
              </span>
              <span className="text-sm text-gray-500">
                {WASTE_CATEGORIES.find(w => w.value === selectedObs.wasteCategory)?.emoji}{' '}
                {WASTE_CATEGORIES.find(w => w.value === selectedObs.wasteCategory)?.label || selectedObs.wasteCategory}
              </span>
            </div>
            <p className="text-gray-900 dark:text-white">{selectedObs.description}</p>
            {selectedObs.operatorQuote && (
              <p className="text-sm text-gray-500 italic mt-3 pl-3 border-l-2 border-gray-300 dark:border-gray-600">
                &ldquo;{selectedObs.operatorQuote}&rdquo;
              </p>
            )}
            {selectedObs.photoUrl && /^https?:\/\//i.test(selectedObs.photoUrl) && (
              <div className="mt-3">
                <a
                  href={selectedObs.photoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-brand-600 hover:underline"
                >
                  View photo
                </a>
              </div>
            )}
            <div className="mt-3 text-xs text-gray-400">
              Created {new Date(selectedObs.createdAt).toLocaleString()}
            </div>
          </div>

          {/* Status changer */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Status</label>
            <div className="grid grid-cols-2 gap-2">
              {OBS_STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => updateObsStatus(selectedObs.id, s)}
                  className={`py-2.5 px-3 rounded-lg text-sm font-medium capitalize transition-colors border ${
                    selectedObs.status === s
                      ? `${STATUS_BADGE[s]} border-current ring-1 ring-current/20`
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* PDCA Follow-up */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4" /> Action Follow-up (PDCA)
            </h3>

            {selectedObs.completedAt ? (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Action completed on {new Date(selectedObs.completedAt).toLocaleDateString()}
                </div>
                {selectedObs.actionRequired && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{selectedObs.actionRequired}</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Action Required</label>
                  <textarea
                    value={pdcaAction}
                    onChange={e => setPdcaAction(e.target.value)}
                    rows={2}
                    placeholder="What needs to be done?"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assign To</label>
                    <select
                      value={pdcaAssignee}
                      onChange={e => setPdcaAssignee(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                    >
                      <option value="">— Unassigned —</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={pdcaDueDate}
                      onChange={e => setPdcaDueDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                    />
                  </div>
                </div>

                {/* Overdue warning */}
                {selectedObs.dueDate && !selectedObs.completedAt && new Date(selectedObs.dueDate) < new Date() && (
                  <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="text-xs text-red-700 dark:text-red-400 font-medium">
                      This action is overdue (due {new Date(selectedObs.dueDate).toLocaleDateString()})
                    </span>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => savePdca(selectedObs.id)}
                    disabled={pdcaSaving}
                    className="flex-1 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {pdcaSaving ? 'Saving...' : 'Save Action Plan'}
                  </button>
                  {selectedObs.actionRequired && (
                    <button
                      onClick={() => markPdcaComplete(selectedObs.id)}
                      className="py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Complete
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
