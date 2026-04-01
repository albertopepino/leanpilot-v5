'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  Timer, Plus, X, ChevronRight, Loader2, ArrowLeft,
  ArrowRightLeft, Clock, CheckCircle2, BarChart3,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';

// ── Types ──────────────────────────────────────────────────────────────

interface SmedAnalysis {
  id: string;
  title: string;
  workstation?: string;
  productFrom?: string;
  productTo?: string;
  baselineMinutes: number;
  currentMinutes: number;
  targetMinutes: number;
  status: 'draft' | 'in_progress' | 'completed';
  activities: SmedActivity[];
  createdAt: string;
  updatedAt: string;
}

interface SmedActivity {
  id: string;
  sequence: number;
  description: string;
  type: 'internal' | 'external';
  durationMinutes: number;
}

type View = 'list' | 'detail' | 'create';

// ── Constants ──────────────────────────────────────────────────────────

const TYPE_BADGE: Record<string, string> = {
  internal: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  external: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

// ── Page ───────────────────────────────────────────────────────────────

export default function SmedPage() {
  const [analyses, setAnalyses] = useState<SmedAnalysis[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<SmedAnalysis | null>(null);
  const [view, setView] = useState<View>('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { toast } = useToast();

  // Create form
  const [createTitle, setCreateTitle] = useState('');
  const [createWorkstation, setCreateWorkstation] = useState('');
  const [createProductFrom, setCreateProductFrom] = useState('');
  const [createProductTo, setCreateProductTo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Add activity form
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [actDesc, setActDesc] = useState('');
  const [actType, setActType] = useState<'internal' | 'external'>('internal');
  const [actDuration, setActDuration] = useState('');
  const [actSubmitting, setActSubmitting] = useState(false);

  // Edit targets
  const [editTargets, setEditTargets] = useState(false);
  const [editBaseline, setEditBaseline] = useState('');
  const [editTarget, setEditTarget] = useState('');

  const loadAnalyses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<SmedAnalysis[]>('/smed');
      setAnalyses(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalyses();
  }, [loadAnalyses]);

  const openAnalysis = async (id: string) => {
    try {
      setLoading(true);
      const detail = await api.get<SmedAnalysis>(`/smed/${id}`);
      setSelectedAnalysis(detail);
      setView('detail');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const createAnalysis = async () => {
    if (!createTitle.trim()) return;
    setSubmitting(true);
    try {
      const analysis = await api.post<SmedAnalysis>('/smed', {
        title: createTitle.trim(),
        workstation: createWorkstation.trim() || undefined,
        productFrom: createProductFrom.trim() || undefined,
        productTo: createProductTo.trim() || undefined,
      });
      setCreateTitle('');
      setCreateWorkstation('');
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
      await api.post(`/smed/${selectedAnalysis.id}/activities`, {
        description: actDesc.trim(),
        type: actType,
        durationMinutes: parseFloat(actDuration),
      });
      setActDesc('');
      setActType('internal');
      setActDuration('');
      setShowAddActivity(false);
      const detail = await api.get<SmedAnalysis>(`/smed/${selectedAnalysis.id}`);
      setSelectedAnalysis(detail);
      toast('success', 'Activity added');
    } catch (e: any) {
      toast('error', e.message || 'Failed to add activity');
    } finally {
      setActSubmitting(false);
    }
  };

  const convertActivity = async (actId: string, newType: 'internal' | 'external') => {
    if (!selectedAnalysis) return;
    try {
      await api.patch(`/smed/${selectedAnalysis.id}/activities/${actId}`, { type: newType });
      const detail = await api.get<SmedAnalysis>(`/smed/${selectedAnalysis.id}`);
      setSelectedAnalysis(detail);
      toast('success', `Activity converted to ${newType}`);
    } catch (e: any) {
      toast('error', e.message || 'Failed to convert activity');
    }
  };

  const saveTargets = async () => {
    if (!selectedAnalysis) return;
    try {
      await api.patch(`/smed/${selectedAnalysis.id}`, {
        baselineMinutes: editBaseline ? parseFloat(editBaseline) : undefined,
        targetMinutes: editTarget ? parseFloat(editTarget) : undefined,
      });
      const detail = await api.get<SmedAnalysis>(`/smed/${selectedAnalysis.id}`);
      setSelectedAnalysis(detail);
      setEditTargets(false);
      toast('success', 'Targets updated');
    } catch (e: any) {
      toast('error', e.message || 'Failed to update targets');
    }
  };

  // Computed values for detail view
  const internalTime = selectedAnalysis?.activities.filter(a => a.type === 'internal').reduce((sum, a) => sum + a.durationMinutes, 0) || 0;
  const externalTime = selectedAnalysis?.activities.filter(a => a.type === 'external').reduce((sum, a) => sum + a.durationMinutes, 0) || 0;
  const totalTime = internalTime + externalTime;
  const internalPct = totalTime > 0 ? Math.round((internalTime / totalTime) * 100) : 0;
  const externalPct = totalTime > 0 ? Math.round((externalTime / totalTime) * 100) : 0;
  const improvementPct = selectedAnalysis && selectedAnalysis.baselineMinutes > 0
    ? Math.round(((selectedAnalysis.baselineMinutes - totalTime) / selectedAnalysis.baselineMinutes) * 100)
    : 0;

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
            {view === 'list' ? 'SMED — Changeover Analysis' : view === 'create' ? 'New SMED Analysis' : selectedAnalysis?.title || 'SMED Analysis'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {view === 'list' ? 'Single-Minute Exchange of Die — reduce changeover times' : view === 'create' ? 'Set up a new changeover study' : `${selectedAnalysis?.workstation?.name || 'Workstation'}: ${selectedAnalysis?.productFrom || '?'} → ${selectedAnalysis?.productTo || '?'}`}
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

      {/* Analysis List */}
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
                          {analysis.status.replace('_', ' ')}
                        </span>
                        {analysis.workstation && (
                          <span className="text-xs text-gray-500">{analysis.workstation?.name}</span>
                        )}
                        {analysis.productFrom && analysis.productTo && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <ArrowRightLeft className="w-3 h-3" />
                            {analysis.productFrom} → {analysis.productTo}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span>Baseline: {analysis.baselineMinutes}m</span>
                        <span>Current: {analysis.currentMinutes}m</span>
                        <span>Target: {analysis.targetMinutes}m</span>
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

      {/* Create Form */}
      {view === 'create' && (
        <div className="max-w-xl space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
            <input
              type="text"
              value={createTitle}
              onChange={e => setCreateTitle(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              placeholder="e.g. Line A — Product X to Product Y"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Workstation / Line</label>
            <input
              type="text"
              value={createWorkstation}
              onChange={e => setCreateWorkstation(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              placeholder="e.g. CNC-01, Assembly Line B"
            />
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
            disabled={!createTitle.trim() || submitting}
            className="w-full flex items-center justify-center gap-2 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium disabled:opacity-50 transition-colors"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create SMED Analysis
          </button>
        </div>
      )}

      {/* Detail View */}
      {view === 'detail' && selectedAnalysis && !loading && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Baseline</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{selectedAnalysis.baselineMinutes}<span className="text-sm font-normal text-gray-400">m</span></p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Current</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{totalTime}<span className="text-sm font-normal text-gray-400">m</span></p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs font-semibold text-green-400 uppercase tracking-wider">Target</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{selectedAnalysis.targetMinutes}<span className="text-sm font-normal text-gray-400">m</span></p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Improvement</p>
              <p className={`text-2xl font-bold mt-1 ${improvementPct > 0 ? 'text-green-600 dark:text-green-400' : improvementPct < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                {improvementPct > 0 ? '+' : ''}{improvementPct}<span className="text-sm font-normal text-gray-400">%</span>
              </p>
            </div>
          </div>

          {/* Edit Targets */}
          {!editTargets ? (
            <button
              onClick={() => {
                setEditBaseline(String(selectedAnalysis.baselineMinutes));
                setEditTarget(String(selectedAnalysis.targetMinutes));
                setEditTargets(true);
              }}
              className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium"
            >
              Edit baseline & target times
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

          {/* Internal vs External Pie (simple bar) */}
          {totalTime > 0 && (
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
                  Internal: {internalTime}m ({internalPct}%)
                </span>
                <span className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-green-400 dark:bg-green-500" />
                  External: {externalTime}m ({externalPct}%)
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

            {selectedAnalysis.activities.length === 0 ? (
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
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Duration</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAnalysis.activities
                      .sort((a, b) => a.sequence - b.sequence)
                      .map((act, idx) => (
                        <tr
                          key={act.id}
                          className={`border-b border-gray-100 dark:border-gray-700/50 ${
                            act.type === 'internal' ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                          }`}
                        >
                          <td className="px-4 py-2.5 text-sm text-gray-500">{act.sequence || idx + 1}</td>
                          <td className="px-4 py-2.5 text-sm text-gray-900 dark:text-white">{act.description}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${TYPE_BADGE[act.type]}`}>
                              {act.type}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-sm text-right text-gray-700 dark:text-gray-300 tabular-nums">
                            {act.durationMinutes}m
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {act.type === 'internal' ? (
                              <button
                                onClick={() => convertActivity(act.id, 'external')}
                                className="text-xs text-green-600 dark:text-green-400 hover:underline font-medium flex items-center gap-1 ml-auto"
                              >
                                <ArrowRightLeft className="w-3 h-3" /> To External
                              </button>
                            ) : (
                              <button
                                onClick={() => convertActivity(act.id, 'internal')}
                                className="text-xs text-red-600 dark:text-red-400 hover:underline font-medium flex items-center gap-1 ml-auto"
                              >
                                <ArrowRightLeft className="w-3 h-3" /> To Internal
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
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
                <button onClick={() => setShowAddActivity(false)} aria-label="Cancel">
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
        </div>
      )}
    </div>
  );
}
