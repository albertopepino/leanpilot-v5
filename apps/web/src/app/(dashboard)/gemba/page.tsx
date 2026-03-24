'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import FileUpload from '@/components/FileUpload';
import {
  Eye, Plus, CheckCircle2, Clock, ChevronRight, X, Send,
  AlertTriangle, Loader2, ArrowLeft,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';

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
  createdAt: string;
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

  const loadWalks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<GembaWalk[]>('/gemba');
      setWalks(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWalks();
    api.get<Workstation[]>('/workstations').then(ws => setWorkstations(Array.isArray(ws) ? ws : [])).catch(() => {});
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
          <button
            onClick={startNewWalk}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium text-sm disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Start Walk
          </button>
        )}
        {view === 'detail' && selectedWalk?.status === 'in_progress' && (
          <div className="flex gap-2">
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
          {selectedWalk.observations.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500">No observations yet. Add your first one!</p>
            </div>
          ) : (
            selectedWalk.observations.map(obs => (
              <button
                key={obs.id}
                onClick={() => { setSelectedObs(obs); setView('obs-detail'); }}
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
                <div className="flex items-center justify-end mt-2">
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
        </div>
      )}
    </div>
  );
}
