'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import {
  Timer, Plus, X, ChevronRight, Loader2, ArrowLeft,
  ArrowRightLeft, Clock, CheckCircle2, BarChart3,
  Trash2, Play, Square, FileText, AlertCircle,
  ChevronDown, Pencil, Save,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';

// -- Types ------------------------------------------------------------------

interface Workstation {
  id: string;
  name: string;
  code: string;
  type?: string;
  area?: string;
  isActive?: boolean;
}

interface SmedActivity {
  id: string;
  sequence: number;
  description: string;
  type: 'internal' | 'external';
  durationSeconds: number;
  canConvert: boolean;
  convertedTo?: 'internal' | 'external' | null;
  improvement?: string | null;
}

interface SmedAnalysis {
  id: string;
  title: string;
  workstationId: string;
  workstation?: { id: string; name: string; code: string };
  productFrom?: string;
  productTo?: string;
  baselineMinutes: number | null;
  targetMinutes: number | null;
  actualMinutes: number | null;
  notes?: string | null;
  status: 'recording' | 'analyzing' | 'improved' | 'verified';
  activities: SmedActivity[];
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

type View = 'list' | 'detail' | 'create';

// -- Constants --------------------------------------------------------------

const TYPE_BADGE: Record<string, string> = {
  internal: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  external: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const STATUS_BADGE: Record<string, string> = {
  recording: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  analyzing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  improved: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  verified: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const STATUS_STEPS: SmedAnalysis['status'][] = ['recording', 'analyzing', 'improved', 'verified'];

const STATUS_LABELS: Record<string, string> = {
  recording: 'Recording',
  analyzing: 'Analyzing',
  improved: 'Improved',
  verified: 'Verified',
};

/** Convert seconds to a human-readable string like "5m 30s" */
function fmtDuration(seconds: number): string {
  if (seconds <= 0) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

/** Convert seconds to minutes (decimal, 1 digit) */
function secToMin(seconds: number): string {
  return (seconds / 60).toFixed(1);
}

// -- Page -------------------------------------------------------------------

export default function SmedPage() {
  const [analyses, setAnalyses] = useState<SmedAnalysis[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<SmedAnalysis | null>(null);
  const [view, setView] = useState<View>('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { toast } = useToast();

  // Workstations for create form
  const [workstations, setWorkstations] = useState<Workstation[]>([]);

  // Create form
  const [createTitle, setCreateTitle] = useState('');
  const [createWorkstationId, setCreateWorkstationId] = useState('');
  const [createProductFrom, setCreateProductFrom] = useState('');
  const [createProductTo, setCreateProductTo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Add activity form
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [actDesc, setActDesc] = useState('');
  const [actType, setActType] = useState<'internal' | 'external'>('internal');
  const [actDuration, setActDuration] = useState('');
  const [actCanConvert, setActCanConvert] = useState(false);
  const [actSubmitting, setActSubmitting] = useState(false);

  // Edit targets
  const [editTargets, setEditTargets] = useState(false);
  const [editBaseline, setEditBaseline] = useState('');
  const [editTarget, setEditTarget] = useState('');

  // Notes editing
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Stopwatch
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Improvement inline edit
  const [editingImprovementId, setEditingImprovementId] = useState<string | null>(null);
  const [improvementText, setImprovementText] = useState('');

  // Actual minutes prompt for "verified" transition
  const [showActualPrompt, setShowActualPrompt] = useState(false);
  const [actualMinutesInput, setActualMinutesInput] = useState('');

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ---- Data loading -------------------------------------------------------

  const loadAnalyses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>('/smed');
      setAnalyses(Array.isArray(res) ? res : res.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWorkstations = useCallback(async () => {
    try {
      const ws = await api.get<Workstation[]>('/workstations');
      setWorkstations(Array.isArray(ws) ? ws.filter(w => w.isActive !== false) : []);
    } catch {
      // silently ignore -- workstations are optional context
    }
  }, []);

  useEffect(() => {
    loadAnalyses();
    loadWorkstations();
  }, [loadAnalyses, loadWorkstations]);

  const refreshDetail = useCallback(async (id: string) => {
    const detail = await api.get<SmedAnalysis>(`/smed/${id}`);
    setSelectedAnalysis(detail);
    return detail;
  }, []);

  const openAnalysis = async (id: string) => {
    try {
      setLoading(true);
      await refreshDetail(id);
      setView('detail');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ---- CRUD ---------------------------------------------------------------

  const createAnalysis = async () => {
    if (!createTitle.trim() || !createWorkstationId) return;
    setSubmitting(true);
    try {
      const analysis = await api.post<SmedAnalysis>('/smed', {
        title: createTitle.trim(),
        workstationId: createWorkstationId,
        productFrom: createProductFrom.trim() || undefined,
        productTo: createProductTo.trim() || undefined,
      });
      setCreateTitle('');
      setCreateWorkstationId('');
      setCreateProductFrom('');
      setCreateProductTo('');
      toast('success', 'SMED analysis created');
      await openAnalysis(analysis.id);
      await loadAnalyses();
    } catch (e: any) {
      toast('error', e.message || 'Failed to create SMED analysis');
    } finally {
      setSubmitting(false);
    }
  };

  const addActivity = async () => {
    if (!selectedAnalysis || !actDesc.trim() || !actDuration) return;
    setActSubmitting(true);
    try {
      const durationSeconds = Math.round(parseFloat(actDuration) * 60);
      const nextSeq = selectedAnalysis.activities.length > 0
        ? Math.max(...selectedAnalysis.activities.map(a => a.sequence)) + 1
        : 1;
      await api.post(`/smed/${selectedAnalysis.id}/activities`, {
        description: actDesc.trim(),
        type: actType,
        durationSeconds,
        canConvert: actCanConvert,
        sequence: nextSeq,
      });
      setActDesc('');
      setActType('internal');
      setActDuration('');
      setActCanConvert(false);
      setShowAddActivity(false);
      await refreshDetail(selectedAnalysis.id);
      toast('success', 'Activity added');
    } catch (e: any) {
      toast('error', e.message || 'Failed to add activity');
    } finally {
      setActSubmitting(false);
    }
  };

  const deleteActivity = async (actId: string) => {
    if (!selectedAnalysis) return;
    try {
      await api.delete(`/smed/${selectedAnalysis.id}/activities/${actId}`);
      await refreshDetail(selectedAnalysis.id);
      setConfirmDeleteId(null);
      toast('success', 'Activity removed');
    } catch (e: any) {
      toast('error', e.message || 'Failed to remove activity');
    }
  };

  const convertActivity = async (actId: string, newType: 'internal' | 'external') => {
    if (!selectedAnalysis) return;
    try {
      await api.patch(`/smed/${selectedAnalysis.id}/activities/${actId}`, {
        convertedTo: newType,
      });
      await refreshDetail(selectedAnalysis.id);
      toast('success', `Activity converted to ${newType}`);
    } catch (e: any) {
      toast('error', e.message || 'Failed to convert activity');
    }
  };

  const saveImprovementNote = async (actId: string) => {
    if (!selectedAnalysis) return;
    try {
      await api.patch(`/smed/${selectedAnalysis.id}/activities/${actId}`, {
        improvement: improvementText || null,
      });
      await refreshDetail(selectedAnalysis.id);
      setEditingImprovementId(null);
      setImprovementText('');
      toast('success', 'Improvement note saved');
    } catch (e: any) {
      toast('error', e.message || 'Failed to save improvement');
    }
  };

  const toggleCanConvert = async (actId: string, canConvert: boolean) => {
    if (!selectedAnalysis) return;
    try {
      await api.patch(`/smed/${selectedAnalysis.id}/activities/${actId}`, { canConvert });
      await refreshDetail(selectedAnalysis.id);
    } catch (e: any) {
      toast('error', e.message || 'Failed to update activity');
    }
  };

  const saveTargets = async () => {
    if (!selectedAnalysis) return;
    try {
      await api.patch(`/smed/${selectedAnalysis.id}`, {
        baselineMinutes: editBaseline ? parseFloat(editBaseline) : undefined,
        targetMinutes: editTarget ? parseFloat(editTarget) : undefined,
      });
      await refreshDetail(selectedAnalysis.id);
      setEditTargets(false);
      toast('success', 'Targets updated');
    } catch (e: any) {
      toast('error', e.message || 'Failed to update targets');
    }
  };

  const saveNotes = async () => {
    if (!selectedAnalysis) return;
    setSavingNotes(true);
    try {
      await api.patch(`/smed/${selectedAnalysis.id}`, {
        notes: notesText || null,
      });
      await refreshDetail(selectedAnalysis.id);
      setEditingNotes(false);
      toast('success', 'Notes saved');
    } catch (e: any) {
      toast('error', e.message || 'Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  // ---- Status progression -------------------------------------------------

  const advanceStatus = async (nextStatus: SmedAnalysis['status']) => {
    if (!selectedAnalysis) return;
    // If advancing to verified, prompt for actualMinutes first
    if (nextStatus === 'verified') {
      setActualMinutesInput(selectedAnalysis.actualMinutes?.toString() || '');
      setShowActualPrompt(true);
      return;
    }
    try {
      await api.patch(`/smed/${selectedAnalysis.id}`, { status: nextStatus });
      await refreshDetail(selectedAnalysis.id);
      await loadAnalyses();
      toast('success', `Status changed to ${STATUS_LABELS[nextStatus]}`);
    } catch (e: any) {
      toast('error', e.message || 'Failed to update status');
    }
  };

  const confirmVerified = async () => {
    if (!selectedAnalysis) return;
    try {
      await api.patch(`/smed/${selectedAnalysis.id}`, {
        status: 'verified',
        actualMinutes: actualMinutesInput ? parseFloat(actualMinutesInput) : undefined,
      });
      setShowActualPrompt(false);
      await refreshDetail(selectedAnalysis.id);
      await loadAnalyses();
      toast('success', 'Analysis verified');
    } catch (e: any) {
      toast('error', e.message || 'Failed to verify analysis');
    }
  };

  const getNextStatus = (current: SmedAnalysis['status']): SmedAnalysis['status'] | null => {
    const idx = STATUS_STEPS.indexOf(current);
    return idx < STATUS_STEPS.length - 1 ? STATUS_STEPS[idx + 1] : null;
  };

  // ---- Stopwatch ----------------------------------------------------------

  const startTimer = () => {
    const now = Date.now();
    setTimerStart(now);
    setTimerElapsed(0);
    setTimerRunning(true);
    timerRef.current = setInterval(() => {
      setTimerElapsed(Math.floor((Date.now() - now) / 1000));
    }, 200);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setTimerRunning(false);
    // Auto-fill duration field (convert seconds to minutes for the input)
    if (timerElapsed > 0) {
      setActDuration((timerElapsed / 60).toFixed(2));
    }
    setTimerStart(null);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ---- Computed values for detail view ------------------------------------

  const activities = selectedAnalysis?.activities || [];
  const effectiveType = (act: SmedActivity) => act.convertedTo || act.type;
  const internalSeconds = activities.filter(a => effectiveType(a) === 'internal').reduce((sum, a) => sum + a.durationSeconds, 0);
  const externalSeconds = activities.filter(a => effectiveType(a) === 'external').reduce((sum, a) => sum + a.durationSeconds, 0);
  const totalSeconds = internalSeconds + externalSeconds;
  const totalMinutes = totalSeconds / 60;
  const internalPct = totalSeconds > 0 ? Math.round((internalSeconds / totalSeconds) * 100) : 0;
  const externalPct = totalSeconds > 0 ? Math.round((externalSeconds / totalSeconds) * 100) : 0;
  const improvementPct = selectedAnalysis && selectedAnalysis.baselineMinutes && selectedAnalysis.baselineMinutes > 0
    ? Math.round(((selectedAnalysis.baselineMinutes - totalMinutes) / selectedAnalysis.baselineMinutes) * 100)
    : 0;

  // ---- Workstation display helper -----------------------------------------

  const wsName = (a: SmedAnalysis) => a.workstation?.name || a.workstation?.code || '';

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div>
      {/* Breadcrumb */}
      {view !== 'list' && (
        <Breadcrumb items={[
          { label: 'SMED', onClick: () => { setView('list'); setSelectedAnalysis(null); } },
          ...(view === 'detail' ? [{ label: selectedAnalysis?.title || 'Analysis' }] : []),
          ...(view === 'create' ? [{ label: 'New Analysis' }] : []),
        ]} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Timer className="w-6 h-6 text-brand-600" />
            {view === 'list' ? 'SMED -- Changeover Analysis' : view === 'create' ? 'New SMED Analysis' : selectedAnalysis?.title || 'SMED Analysis'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {view === 'list'
              ? 'Single-Minute Exchange of Die -- reduce changeover times'
              : view === 'create'
                ? 'Set up a new changeover study'
                : `${wsName(selectedAnalysis!)}: ${selectedAnalysis?.productFrom || '?'} -> ${selectedAnalysis?.productTo || '?'}`}
          </p>
        </div>
        {view === 'list' && (
          <button
            onClick={() => setView('create')}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium text-sm"
          >
            <Plus className="w-4 h-4" /> New Analysis
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between">
          <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
          <button onClick={() => setError('')} aria-label="Dismiss error"><X className="w-4 h-4 text-red-400" /></button>
        </div>
      )}

      {loading && view !== 'create' && <SkeletonList count={3} />}

      {/* ================================================================ */}
      {/* ANALYSIS LIST                                                    */}
      {/* ================================================================ */}
      {view === 'list' && !loading && (
        <div className="space-y-2">
          {analyses.length === 0 ? (
            <EmptyState
              icon={Timer}
              title="No SMED analyses yet"
              description="Start your first changeover analysis to identify and reduce setup times."
              actionLabel="New Analysis"
              onAction={() => setView('create')}
            />
          ) : (
            analyses.map(analysis => (
              <Card key={analysis.id} onClick={() => openAnalysis(analysis.id)} padding="sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                      <Timer className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{analysis.title}</div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${STATUS_BADGE[analysis.status]}`}>
                          {STATUS_LABELS[analysis.status] || analysis.status}
                        </span>
                        {wsName(analysis) && (
                          <span className="text-xs text-gray-500">{wsName(analysis)}</span>
                        )}
                        {analysis.productFrom && analysis.productTo && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <ArrowRightLeft className="w-3 h-3" />
                            {analysis.productFrom} -&gt; {analysis.productTo}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span>Baseline: {analysis.baselineMinutes ?? '--'}m</span>
                        <span>Current: {secToMin(analysis.activities?.reduce((s, a) => s + a.durationSeconds, 0) || 0)}m</span>
                        <span>Target: {analysis.targetMinutes ?? '--'}m</span>
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

      {/* ================================================================ */}
      {/* CREATE FORM                                                      */}
      {/* ================================================================ */}
      {view === 'create' && (
        <div className="max-w-xl space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
            <input
              type="text"
              value={createTitle}
              onChange={e => setCreateTitle(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              placeholder="e.g. Line A -- Product X to Product Y"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Workstation / Line *</label>
            <select
              value={createWorkstationId}
              onChange={e => setCreateWorkstationId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
            >
              <option value="">Select a workstation...</option>
              {workstations.map(ws => (
                <option key={ws.id} value={ws.id}>{ws.name} ({ws.code})</option>
              ))}
            </select>
            {workstations.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> No workstations found. Create workstations in Equipment first.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product From</label>
              <input
                type="text"
                value={createProductFrom}
                onChange={e => setCreateProductFrom(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="e.g. Part A"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product To</label>
              <input
                type="text"
                value={createProductTo}
                onChange={e => setCreateProductTo(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="e.g. Part B"
              />
            </div>
          </div>
          <button
            onClick={createAnalysis}
            disabled={!createTitle.trim() || !createWorkstationId || submitting}
            className="w-full flex items-center justify-center gap-2 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium disabled:opacity-50 transition-colors"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create SMED Analysis
          </button>
        </div>
      )}

      {/* ================================================================ */}
      {/* DETAIL VIEW                                                      */}
      {/* ================================================================ */}
      {view === 'detail' && selectedAnalysis && !loading && (
        <div className="space-y-4">

          {/* Status Stepper */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Status</h3>
              {(() => {
                const next = getNextStatus(selectedAnalysis.status);
                if (!next) return null;
                return (
                  <button
                    onClick={() => advanceStatus(next)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700 transition-colors"
                  >
                    Advance to {STATUS_LABELS[next]} <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                );
              })()}
            </div>
            <div className="flex items-center gap-1">
              {STATUS_STEPS.map((step, idx) => {
                const currentIdx = STATUS_STEPS.indexOf(selectedAnalysis.status);
                const isCompleted = idx < currentIdx;
                const isCurrent = idx === currentIdx;
                return (
                  <div key={step} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                          isCompleted
                            ? 'bg-green-500 text-white'
                            : isCurrent
                              ? 'bg-brand-600 text-white ring-2 ring-brand-300 dark:ring-brand-700'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                        }`}
                      >
                        {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                      </div>
                      <span className={`text-[10px] mt-1 font-medium ${
                        isCurrent ? 'text-brand-600 dark:text-brand-400' : isCompleted ? 'text-green-600 dark:text-green-400' : 'text-gray-400'
                      }`}>
                        {STATUS_LABELS[step]}
                      </span>
                    </div>
                    {idx < STATUS_STEPS.length - 1 && (
                      <div className={`h-0.5 flex-1 mx-1 rounded ${
                        idx < currentIdx ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700'
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actual Minutes Prompt (modal overlay) */}
          {showActualPrompt && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-sm w-full shadow-xl space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Verify Analysis</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Enter the actual changeover time achieved after improvements.
                </p>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Actual Changeover Time (minutes)</label>
                  <input
                    type="number"
                    value={actualMinutesInput}
                    onChange={e => setActualMinutesInput(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                    placeholder="e.g. 8"
                    min="0"
                    step="0.5"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowActualPrompt(false)}
                    className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmVerified}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700"
                  >
                    Verify
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Baseline</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {selectedAnalysis.baselineMinutes ?? '--'}<span className="text-sm font-normal text-gray-400">m</span>
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Current</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {secToMin(totalSeconds)}<span className="text-sm font-normal text-gray-400">m</span>
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs font-semibold text-green-400 uppercase tracking-wider">Target</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                {selectedAnalysis.targetMinutes ?? '--'}<span className="text-sm font-normal text-gray-400">m</span>
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Actual</p>
              <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 mt-1">
                {selectedAnalysis.actualMinutes ?? '--'}<span className="text-sm font-normal text-gray-400">m</span>
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Improvement</p>
              <p className={`text-2xl font-bold mt-1 ${improvementPct > 0 ? 'text-green-600 dark:text-green-400' : improvementPct < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                {selectedAnalysis.baselineMinutes ? `${improvementPct > 0 ? '+' : ''}${improvementPct}` : '--'}<span className="text-sm font-normal text-gray-400">%</span>
              </p>
            </div>
          </div>

          {/* Edit Targets */}
          {!editTargets ? (
            <button
              onClick={() => {
                setEditBaseline(String(selectedAnalysis.baselineMinutes ?? ''));
                setEditTarget(String(selectedAnalysis.targetMinutes ?? ''));
                setEditTargets(true);
              }}
              className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium"
            >
              Edit baseline &amp; target times
            </button>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Baseline (min)</label>
                  <input
                    type="number"
                    value={editBaseline}
                    onChange={e => setEditBaseline(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Target (min)</label>
                  <input
                    type="number"
                    value={editTarget}
                    onChange={e => setEditTarget(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setEditTargets(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-500">
                  Cancel
                </button>
                <button onClick={saveTargets} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-600 text-white hover:bg-brand-700">
                  Save Targets
                </button>
              </div>
            </div>
          )}

          {/* Internal vs External Bar */}
          {totalSeconds > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4" /> Internal vs External Time
              </h3>
              <div className="flex rounded-lg overflow-hidden h-8 mb-2">
                {internalPct > 0 && (
                  <div
                    className="bg-red-400 dark:bg-red-500 flex items-center justify-center text-xs font-bold text-white"
                    style={{ width: `${internalPct}%` }}
                  >
                    {internalPct}%
                  </div>
                )}
                {externalPct > 0 && (
                  <div
                    className="bg-green-400 dark:bg-green-500 flex items-center justify-center text-xs font-bold text-white"
                    style={{ width: `${externalPct}%` }}
                  >
                    {externalPct}%
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-red-400 dark:bg-red-500" />
                  Internal: {secToMin(internalSeconds)}m ({internalPct}%)
                </span>
                <span className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-green-400 dark:bg-green-500" />
                  External: {secToMin(externalSeconds)}m ({externalPct}%)
                </span>
              </div>
            </div>
          )}

          {/* Activities Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Activities</h3>
              <button
                onClick={() => setShowAddActivity(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700"
              >
                <Plus className="w-3.5 h-3.5" /> Add Activity
              </button>
            </div>

            {activities.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">
                No activities recorded yet. Add changeover steps to analyze.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">#</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Description</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Type</th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Can Convert</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Converted</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Duration</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Improvement</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...activities]
                      .sort((a, b) => a.sequence - b.sequence)
                      .map((act, idx) => {
                        const converted = act.convertedTo && act.convertedTo !== act.type;
                        return (
                          <tr
                            key={act.id}
                            className={`border-b border-gray-100 dark:border-gray-700/50 ${
                              effectiveType(act) === 'internal' ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                            }`}
                          >
                            <td className="px-4 py-2.5 text-sm text-gray-500">{act.sequence || idx + 1}</td>
                            <td className="px-4 py-2.5 text-sm text-gray-900 dark:text-white">{act.description}</td>
                            <td className="px-4 py-2.5">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${TYPE_BADGE[act.type]}`}>
                                {act.type}
                              </span>
                            </td>
                            {/* Can Convert checkbox */}
                            <td className="px-4 py-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={act.canConvert}
                                onChange={e => toggleCanConvert(act.id, e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                title={act.canConvert ? 'Can be converted' : 'Cannot be converted'}
                              />
                            </td>
                            {/* Converted To */}
                            <td className="px-4 py-2.5">
                              {converted ? (
                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${TYPE_BADGE[act.convertedTo!]}`}>
                                  -&gt; {act.convertedTo}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-300 dark:text-gray-600">--</span>
                              )}
                            </td>
                            {/* Duration */}
                            <td className="px-4 py-2.5 text-sm text-right text-gray-700 dark:text-gray-300 tabular-nums">
                              {fmtDuration(act.durationSeconds)}
                            </td>
                            {/* Improvement notes */}
                            <td className="px-4 py-2.5 max-w-[200px]">
                              {editingImprovementId === act.id ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={improvementText}
                                    onChange={e => setImprovementText(e.target.value)}
                                    className="flex-1 px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-brand-500"
                                    placeholder="How was this improved?"
                                    autoFocus
                                    onKeyDown={e => { if (e.key === 'Enter') saveImprovementNote(act.id); if (e.key === 'Escape') setEditingImprovementId(null); }}
                                  />
                                  <button onClick={() => saveImprovementNote(act.id)} className="text-green-600 hover:text-green-700" title="Save">
                                    <Save className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => setEditingImprovementId(null)} className="text-gray-400 hover:text-gray-500" title="Cancel">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingImprovementId(act.id);
                                    setImprovementText(act.improvement || '');
                                  }}
                                  className="text-xs text-left text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 flex items-center gap-1 group"
                                  title="Edit improvement note"
                                >
                                  {act.improvement ? (
                                    <span className="truncate max-w-[160px]">{act.improvement}</span>
                                  ) : (
                                    <span className="text-gray-300 dark:text-gray-600 group-hover:text-brand-400 flex items-center gap-0.5">
                                      <Pencil className="w-3 h-3" /> Add note
                                    </span>
                                  )}
                                </button>
                              )}
                            </td>
                            {/* Actions */}
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex items-center gap-2 justify-end">
                                {act.type === 'internal' ? (
                                  <button
                                    onClick={() => convertActivity(act.id, 'external')}
                                    className="text-xs text-green-600 dark:text-green-400 hover:underline font-medium flex items-center gap-1"
                                    title="Convert to external"
                                  >
                                    <ArrowRightLeft className="w-3 h-3" /> Ext
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => convertActivity(act.id, 'internal')}
                                    className="text-xs text-red-600 dark:text-red-400 hover:underline font-medium flex items-center gap-1"
                                    title="Convert to internal"
                                  >
                                    <ArrowRightLeft className="w-3 h-3" /> Int
                                  </button>
                                )}
                                {confirmDeleteId === act.id ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => deleteActivity(act.id)}
                                      className="text-xs text-red-600 font-medium hover:underline"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      onClick={() => setConfirmDeleteId(null)}
                                      className="text-xs text-gray-400 hover:text-gray-500"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmDeleteId(act.id)}
                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                    title="Delete activity"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Add Activity Form */}
          {showAddActivity && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Add Activity</h3>
                <button onClick={() => { setShowAddActivity(false); stopTimer(); }} aria-label="Cancel">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Description *</label>
                <input
                  type="text"
                  value={actDesc}
                  onChange={e => setActDesc(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="e.g. Remove old die"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActType('internal')}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        actType === 'internal'
                          ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                          : 'border-gray-200 dark:border-gray-700 text-gray-500'
                      }`}
                    >
                      Internal
                    </button>
                    <button
                      onClick={() => setActType('external')}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        actType === 'external'
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                          : 'border-gray-200 dark:border-gray-700 text-gray-500'
                      }`}
                    >
                      External
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Duration (min) *</label>
                  <input
                    type="number"
                    value={actDuration}
                    onChange={e => setActDuration(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                    placeholder="e.g. 5"
                    min="0"
                    step="0.5"
                  />
                </div>
              </div>

              {/* Can Convert checkbox */}
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={actCanConvert}
                  onChange={e => setActCanConvert(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                Can be converted to external (done while machine is running)
              </label>

              {/* Stopwatch */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Stopwatch:</span>
                <span className="text-lg font-mono font-bold text-gray-900 dark:text-white tabular-nums min-w-[80px]">
                  {fmtDuration(timerRunning ? timerElapsed : 0)}
                </span>
                {!timerRunning ? (
                  <button
                    onClick={startTimer}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" /> Start
                  </button>
                ) : (
                  <button
                    onClick={stopTimer}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors"
                  >
                    <Square className="w-3.5 h-3.5" /> Stop
                  </button>
                )}
                {timerElapsed > 0 && !timerRunning && (
                  <span className="text-xs text-gray-400">
                    Duration auto-filled: {(timerElapsed / 60).toFixed(2)}m
                  </span>
                )}
              </div>

              <button
                onClick={addActivity}
                disabled={!actDesc.trim() || !actDuration || actSubmitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium text-sm disabled:opacity-50 transition-colors"
              >
                {actSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add Activity
              </button>
            </div>
          )}

          {/* Notes Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <FileText className="w-4 h-4" /> Analysis Notes
              </h3>
              {!editingNotes && (
                <button
                  onClick={() => {
                    setNotesText(selectedAnalysis.notes || '');
                    setEditingNotes(true);
                  }}
                  className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium flex items-center gap-1"
                >
                  <Pencil className="w-3 h-3" /> Edit
                </button>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-2">
                <textarea
                  value={notesText}
                  onChange={e => setNotesText(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-y"
                  placeholder="Add observations, lessons learned, improvement ideas..."
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingNotes(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveNotes}
                    disabled={savingNotes}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    {savingNotes && <Loader2 className="w-3 h-3 animate-spin" />}
                    Save Notes
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 whitespace-pre-wrap">
                {selectedAnalysis.notes || 'No notes yet. Click Edit to add observations and improvement ideas.'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
