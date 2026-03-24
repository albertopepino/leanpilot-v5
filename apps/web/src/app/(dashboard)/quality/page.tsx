'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import FileUpload from '@/components/FileUpload';
import {
  Plus, ChevronLeft, X, CheckCircle, AlertTriangle,
  FileText, ClipboardList, BarChart3, AlertOctagon,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';

// ===== TYPES =====
interface Checkpoint {
  id: string;
  name: string;
  measurementType: 'pass_fail' | 'measurement';
  targetValue: number | null;
  toleranceMin: number | null;
  toleranceMax: number | null;
  unit: string | null;
  sortOrder: number;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  productFamily: string | null;
  version: number;
  isActive: boolean;
  checkpoints: Checkpoint[];
  createdAt: string;
}

interface Inspection {
  id: string;
  status: 'in_progress' | 'passed' | 'failed';
  workstationId: string | null;
  productionOrderId: string | null;
  notes: string | null;
  template: { name: string };
  inspector: { firstName: string; lastName: string };
  results: InspectionResult[];
  createdAt: string;
}

interface InspectionResult {
  id: string;
  checkpointId: string;
  passed: boolean | null;
  measuredValue: number | null;
  notes: string | null;
  checkpoint: Checkpoint;
}

interface NCR {
  id: string;
  title: string;
  description: string;
  severity: 'minor' | 'major' | 'critical';
  status: string;
  disposition: string | null;
  rootCause: string | null;
  correctiveAction: string | null;
  createdAt: string;
  reportedBy: { firstName: string; lastName: string };
}

type Tab = 'inspections' | 'templates' | 'ncr';
type View = 'list' | 'detail' | 'create' | 'inspect';

const SEVERITY_BADGE: Record<string, string> = {
  minor: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  major: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const NCR_STATUSES = ['open', 'investigating', 'containment', 'corrective_action', 'closed', 'verified'];

export default function QualityPage() {
  const [tab, setTab] = useState<Tab>('inspections');
  const [view, setView] = useState<View>('list');
  const [error, setError] = useState('');
  const { toast } = useToast();

  // Inspections
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [ncrs, setNcrs] = useState<NCR[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInsp, setSelectedInsp] = useState<Inspection | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedNcr, setSelectedNcr] = useState<NCR | null>(null);

  // Create inspection
  const [createTemplateId, setCreateTemplateId] = useState('');

  // Inspection results
  const [results, setResults] = useState<Record<string, { passed?: boolean; value?: number; notes?: string }>>({});
  const [saving, setSaving] = useState(false);

  // NCR form
  const [ncrTitle, setNcrTitle] = useState('');
  const [ncrDesc, setNcrDesc] = useState('');
  const [ncrSeverity, setNcrSeverity] = useState<'minor' | 'major' | 'critical'>('minor');
  const [creating, setCreating] = useState(false);

  // Template form
  const [tmplName, setTmplName] = useState('');
  const [tmplDesc, setTmplDesc] = useState('');
  const [tmplFamily, setTmplFamily] = useState('');
  const [tmplCheckpoints, setTmplCheckpoints] = useState<{ name: string; measurementType: string; unit: string; targetValue: string; toleranceMin: string; toleranceMax: string }[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [insp, tmpl, ncr] = await Promise.all([
        api.get<Inspection[]>('/quality/inspections').catch(() => []),
        api.get<Template[]>('/quality/templates').catch(() => []),
        api.get<NCR[]>('/quality/ncr').catch(() => []),
      ]);
      setInspections(Array.isArray(insp) ? insp : []);
      setTemplates(Array.isArray(tmpl) ? tmpl : []);
      setNcrs(Array.isArray(ncr) ? ncr : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ===== Tab selector =====
  const tabs = [
    { key: 'inspections' as Tab, label: 'Inspections', icon: ClipboardList, count: inspections.length },
    { key: 'templates' as Tab, label: 'Templates', icon: FileText, count: templates.length },
    { key: 'ncr' as Tab, label: 'NCR', icon: AlertOctagon, count: ncrs.length },
  ];

  const switchTab = (t: Tab) => { setTab(t); setView('list'); setError(''); };

  // ===== CREATE INSPECTION =====
  const createInspection = async () => {
    if (!createTemplateId) return;
    setCreating(true);
    setError('');
    try {
      const insp = await api.post<Inspection>('/quality/inspections', { templateId: createTemplateId });
      setInspections(prev => [insp, ...prev]);
      // Load full with checkpoints
      const full = await api.get<Inspection>(`/quality/inspections/${insp.id}`);
      setSelectedInsp(full);
      // Initialize results
      const r: Record<string, { passed?: boolean; value?: number; notes?: string }> = {};
      (full.results || []).forEach(res => {
        r[res.checkpointId] = { passed: res.passed ?? undefined, value: res.measuredValue ?? undefined, notes: res.notes || '' };
      });
      setResults(r);
      setView('inspect');
      toast('success', 'Inspection started');
    } catch (e: any) {
      setError(e.message || 'Failed to create inspection');
    } finally {
      setCreating(false);
    }
  };

  // ===== SUBMIT RESULTS =====
  const submitResults = async () => {
    if (!selectedInsp) return;
    setSaving(true);
    setError('');
    try {
      const payload = Object.entries(results).map(([checkpointId, r]) => ({
        checkpointId,
        passed: r.passed,
        measuredValue: r.value,
        notes: r.notes || undefined,
      }));
      const updated = await api.post<Inspection>(`/quality/inspections/${selectedInsp.id}/results`, { results: payload });
      setSelectedInsp(updated);
      setInspections(prev => prev.map(i => i.id === updated.id ? updated : i));
      setView('detail');
      toast('success', 'Results submitted');
    } catch (e: any) {
      setError(e.message || 'Failed to submit results');
    } finally {
      setSaving(false);
    }
  };

  // ===== CREATE TEMPLATE =====
  const createTemplate = async () => {
    if (!tmplName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const checkpoints = tmplCheckpoints.map((cp, i) => ({
        name: cp.name,
        measurementType: cp.measurementType,
        unit: cp.unit || undefined,
        targetValue: cp.targetValue ? parseFloat(cp.targetValue) : undefined,
        toleranceMin: cp.toleranceMin ? parseFloat(cp.toleranceMin) : undefined,
        toleranceMax: cp.toleranceMax ? parseFloat(cp.toleranceMax) : undefined,
        sortOrder: i,
      }));
      const tmpl = await api.post<Template>('/quality/templates', {
        name: tmplName.trim(),
        description: tmplDesc.trim() || undefined,
        productFamily: tmplFamily.trim() || undefined,
        checkpoints,
      });
      setTemplates(prev => [tmpl, ...prev]);
      setView('list');
      setTmplName(''); setTmplDesc(''); setTmplFamily(''); setTmplCheckpoints([]);
      toast('success', 'Template created');
    } catch (e: any) {
      setError(e.message || 'Failed to create template');
    } finally {
      setCreating(false);
    }
  };

  // ===== CREATE NCR =====
  const createNcr = async () => {
    if (!ncrTitle.trim() || !ncrDesc.trim()) return;
    setCreating(true);
    setError('');
    try {
      const ncr = await api.post<NCR>('/quality/ncr', {
        title: ncrTitle.trim(),
        description: ncrDesc.trim(),
        severity: ncrSeverity,
      });
      setNcrs(prev => [ncr, ...prev]);
      setView('list');
      setNcrTitle(''); setNcrDesc(''); setNcrSeverity('minor');
      toast('success', 'NCR created');
    } catch (e: any) {
      setError(e.message || 'Failed to create NCR');
    } finally {
      setCreating(false);
    }
  };

  // ===== ADD CHECKPOINT TO TEMPLATE FORM =====
  const addCheckpoint = () => {
    setTmplCheckpoints(prev => [...prev, { name: '', measurementType: 'pass_fail', unit: '', targetValue: '', toleranceMin: '', toleranceMax: '' }]);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Quality</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Inspections, checklist templates, and non-conformance reports
          </p>
        </div>
        {view === 'list' && (
          <button
            onClick={() => { setView('create'); setError(''); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            {tab === 'inspections' ? 'New Inspection' : tab === 'templates' ? 'New Template' : 'New NCR'}
          </button>
        )}
      </div>

      {/* Tab bar */}
      {view === 'list' && (
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mb-6 w-fit">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => switchTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  tab === t.key
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
                <span className="text-xs bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded-full">{t.count}</span>
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
          <span className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</span>
          <button onClick={() => setError('')} aria-label="Dismiss error"><X className="w-4 h-4 text-red-400" /></button>
        </div>
      )}

      {loading && <SkeletonList count={3} />}

      {/* ===== INSPECTIONS TAB ===== */}
      {!loading && tab === 'inspections' && view === 'list' && (
        inspections.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <ClipboardList className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No inspections yet</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Create a template first, then start an inspection.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {inspections.map(insp => (
              <button key={insp.id} onClick={() => {
                setSelectedInsp(insp);
                setResults({}); // Clear stale results from previous inspection
                api.get<Inspection>(`/quality/inspections/${insp.id}`).then(full => {
                  setSelectedInsp(full);
                  const r: Record<string, any> = {};
                  (full.results || []).forEach(res => { r[res.checkpointId] = { passed: res.passed, value: res.measuredValue, notes: res.notes || '' }; });
                  setResults(r);
                }).catch(() => {});
                setView('detail');
              }}
                className="w-full text-left bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-sm hover:border-brand-300 transition-all flex items-center justify-between"
              >
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">{insp.template?.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {insp.inspector?.firstName} {insp.inspector?.lastName} — {new Date(insp.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  insp.status === 'passed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  insp.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                }`}>
                  {insp.status === 'in_progress' ? 'In Progress' : insp.status.charAt(0).toUpperCase() + insp.status.slice(1)}
                </span>
              </button>
            ))}
          </div>
        )
      )}

      {/* ===== INSPECTION DETAIL ===== */}
      {tab === 'inspections' && view === 'detail' && selectedInsp && (
        <div>
          <button onClick={() => { setView('list'); setSelectedInsp(null); }} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 mb-4">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedInsp.template?.name}</h2>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                selectedInsp.status === 'passed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                selectedInsp.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
              }`}>
                {selectedInsp.status}
              </span>
              {selectedInsp.status === 'in_progress' && (
                <button onClick={() => {
                  const r: Record<string, { passed?: boolean; value?: number; notes?: string }> = {};
                  (selectedInsp!.results || []).forEach(res => {
                    r[res.checkpointId] = { passed: res.passed ?? undefined, value: res.measuredValue ?? undefined, notes: res.notes || '' };
                  });
                  setResults(r);
                  setView('inspect');
                }} className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium">
                  Continue Inspection
                </button>
              )}
            </div>
          </div>
          <div className="space-y-3">
            {(selectedInsp.results || []).map(r => (
              <div key={r.id} className={`bg-white dark:bg-gray-800 rounded-lg border p-4 ${
                r.passed === true ? 'border-green-200 dark:border-green-800' :
                r.passed === false ? 'border-red-200 dark:border-red-800' :
                'border-gray-200 dark:border-gray-700'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-white text-sm">{r.checkpoint?.name}</span>
                  {r.passed === true && <CheckCircle className="w-5 h-5 text-green-500" />}
                  {r.passed === false && <AlertTriangle className="w-5 h-5 text-red-500" />}
                </div>
                {r.measuredValue !== null && (
                  <p className="text-sm text-gray-500 mt-1">Measured: {r.measuredValue} {r.checkpoint?.unit || ''}</p>
                )}
                {r.notes && <p className="text-xs text-gray-400 mt-1 italic">{r.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== INSPECT (fill results) ===== */}
      {tab === 'inspections' && view === 'inspect' && selectedInsp && (
        <div>
          <button onClick={() => setView('detail')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 mb-4">
            <ChevronLeft className="w-4 h-4" /> Back to detail
          </button>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Inspect: {selectedInsp.template?.name}</h2>
          <div className="space-y-4 mb-6">
            {(selectedInsp.results || []).map(r => {
              const cp = r.checkpoint;
              const val = results[r.checkpointId] || {};
              return (
                <div key={r.checkpointId} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-2">{cp?.name}</h4>
                  {cp?.measurementType === 'pass_fail' ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setResults(p => ({ ...p, [r.checkpointId]: { ...p[r.checkpointId], passed: true } }))}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                          val.passed === true ? 'bg-green-100 border-green-400 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        Pass
                      </button>
                      <button
                        onClick={() => setResults(p => ({ ...p, [r.checkpointId]: { ...p[r.checkpointId], passed: false } }))}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                          val.passed === false ? 'bg-red-100 border-red-400 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        Fail
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <input
                          type="number"
                          step="any"
                          value={val.value ?? ''}
                          onChange={e => {
                            const v = e.target.value === '' ? undefined : parseFloat(e.target.value);
                            const inRange = v !== undefined && cp?.toleranceMin !== null && cp?.toleranceMax !== null
                              ? v >= (cp.toleranceMin ?? -Infinity) && v <= (cp.toleranceMax ?? Infinity)
                              : undefined;
                            setResults(p => ({ ...p, [r.checkpointId]: { ...p[r.checkpointId], value: v, passed: inRange } }));
                          }}
                          placeholder={`Target: ${cp?.targetValue ?? '—'} ${cp?.unit || ''}`}
                          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                        />
                        <span className="text-xs text-gray-400">{cp?.unit || ''}</span>
                      </div>
                      {cp?.toleranceMin !== null && cp?.toleranceMax !== null && (
                        <p className="text-xs text-gray-400">Range: {cp?.toleranceMin} — {cp?.toleranceMax}</p>
                      )}
                    </div>
                  )}
                  <input
                    type="text"
                    value={val.notes || ''}
                    onChange={e => setResults(p => ({ ...p, [r.checkpointId]: { ...p[r.checkpointId], notes: e.target.value } }))}
                    placeholder="Notes..."
                    className="mt-2 w-full px-3 py-1.5 rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-700 dark:text-gray-300"
                  />
                </div>
              );
            })}
          </div>
          <button onClick={submitResults} disabled={saving}
            className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium"
          >
            {saving ? 'Submitting...' : 'Submit Results'}
          </button>
        </div>
      )}

      {/* ===== CREATE INSPECTION ===== */}
      {tab === 'inspections' && view === 'create' && (
        <div>
          <button onClick={() => setView('list')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 mb-4">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Start Inspection</h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-lg">
            <label className="block mb-4">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Template *</span>
              <select value={createTemplateId} onChange={e => setCreateTemplateId(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
              >
                <option value="">Choose a template...</option>
                {templates.filter(t => t.isActive).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            <button onClick={createInspection} disabled={creating || !createTemplateId}
              className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium"
            >
              {creating ? 'Creating...' : 'Start Inspection'}
            </button>
          </div>
        </div>
      )}

      {/* ===== TEMPLATES TAB ===== */}
      {!loading && tab === 'templates' && view === 'list' && (
        templates.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No templates yet</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Create a quality checklist template to get started.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {templates.map(tmpl => (
              <button key={tmpl.id} onClick={() => { setSelectedTemplate(tmpl); setView('detail'); }}
                className="w-full text-left bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-sm hover:border-brand-300 transition-all flex items-center justify-between"
              >
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">{tmpl.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {tmpl.checkpoints?.length || 0} checkpoints
                    {tmpl.productFamily && <> — {tmpl.productFamily}</>}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  tmpl.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500'
                }`}>
                  {tmpl.isActive ? 'Active' : 'Inactive'}
                </span>
              </button>
            ))}
          </div>
        )
      )}

      {/* ===== TEMPLATE DETAIL ===== */}
      {tab === 'templates' && view === 'detail' && selectedTemplate && (
        <div>
          <button onClick={() => { setView('list'); setSelectedTemplate(null); }} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 mb-4">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{selectedTemplate.name}</h2>
          {selectedTemplate.description && <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">{selectedTemplate.description}</p>}
          <div className="space-y-2">
            {(selectedTemplate.checkpoints || []).sort((a, b) => a.sortOrder - b.sortOrder).map((cp, i) => (
              <div key={cp.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex items-center gap-3">
                <span className="text-xs text-gray-400 font-mono w-6">{i + 1}.</span>
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{cp.name}</span>
                  {cp.measurementType === 'measurement' && (
                    <span className="text-xs text-gray-400 ml-2">
                      Target: {cp.targetValue ?? '—'} {cp.unit ?? ''} [{cp.toleranceMin ?? '—'}–{cp.toleranceMax ?? '—'}]
                    </span>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  cp.measurementType === 'pass_fail' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400'
                }`}>
                  {cp.measurementType === 'pass_fail' ? 'Pass/Fail' : 'Measurement'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== CREATE TEMPLATE ===== */}
      {tab === 'templates' && view === 'create' && (
        <div>
          <button onClick={() => setView('list')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 mb-4">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">New Template</h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-2xl">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <label className="block">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Name *</span>
                <input type="text" value={tmplName} onChange={e => setTmplName(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Product Family</span>
                <input type="text" value={tmplFamily} onChange={e => setTmplFamily(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                />
              </label>
            </div>
            <label className="block mb-4">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</span>
              <textarea value={tmplDesc} onChange={e => setTmplDesc(e.target.value)} rows={2}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
              />
            </label>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Checkpoints</h3>
            <div className="space-y-3 mb-4">
              {tmplCheckpoints.map((cp, i) => (
                <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-400 font-mono">{i + 1}.</span>
                    <input type="text" value={cp.name} onChange={e => {
                      const arr = [...tmplCheckpoints]; arr[i] = { ...arr[i], name: e.target.value }; setTmplCheckpoints(arr);
                    }} placeholder="Checkpoint name"
                      className="flex-1 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                    />
                    <select value={cp.measurementType} onChange={e => {
                      const arr = [...tmplCheckpoints]; arr[i] = { ...arr[i], measurementType: e.target.value }; setTmplCheckpoints(arr);
                    }}
                      className="px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white"
                    >
                      <option value="pass_fail">Pass/Fail</option>
                      <option value="measurement">Measurement</option>
                    </select>
                    <button onClick={() => setTmplCheckpoints(prev => prev.filter((_, j) => j !== i))}
                      className="text-red-400 hover:text-red-600" aria-label="Remove checkpoint"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {cp.measurementType === 'measurement' && (
                    <div className="flex gap-2 ml-6">
                      <input type="text" value={cp.unit} onChange={e => {
                        const arr = [...tmplCheckpoints]; arr[i] = { ...arr[i], unit: e.target.value }; setTmplCheckpoints(arr);
                      }} placeholder="Unit" className="w-16 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs" />
                      <input type="number" value={cp.targetValue} onChange={e => {
                        const arr = [...tmplCheckpoints]; arr[i] = { ...arr[i], targetValue: e.target.value }; setTmplCheckpoints(arr);
                      }} placeholder="Target" className="w-20 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs" />
                      <input type="number" value={cp.toleranceMin} onChange={e => {
                        const arr = [...tmplCheckpoints]; arr[i] = { ...arr[i], toleranceMin: e.target.value }; setTmplCheckpoints(arr);
                      }} placeholder="Min" className="w-16 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs" />
                      <input type="number" value={cp.toleranceMax} onChange={e => {
                        const arr = [...tmplCheckpoints]; arr[i] = { ...arr[i], toleranceMax: e.target.value }; setTmplCheckpoints(arr);
                      }} placeholder="Max" className="w-16 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addCheckpoint} className="text-sm text-brand-600 hover:text-brand-700 font-medium mb-6 flex items-center gap-1">
              <Plus className="w-4 h-4" /> Add Checkpoint
            </button>
            <button onClick={createTemplate} disabled={creating || !tmplName.trim() || tmplCheckpoints.length === 0 || tmplCheckpoints.some(cp => !cp.name.trim())}
              className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium"
            >
              {creating ? 'Creating...' : 'Create Template'}
            </button>
          </div>
        </div>
      )}

      {/* ===== NCR TAB ===== */}
      {!loading && tab === 'ncr' && view === 'list' && (
        ncrs.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <AlertOctagon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No NCRs yet</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Report non-conformances to track and resolve quality issues.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {ncrs.map(ncr => (
              <button key={ncr.id} onClick={() => {
                api.get<NCR>(`/quality/ncr/${ncr.id}`).then(full => setSelectedNcr(full)).catch(() => setSelectedNcr(ncr));
                setSelectedNcr(ncr);
                setView('detail');
              }}
                className="w-full text-left bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-sm hover:border-brand-300 transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-medium text-gray-900 dark:text-white">{ncr.title}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${SEVERITY_BADGE[ncr.severity]}`}>
                    {ncr.severity}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">{ncr.description}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-400">{ncr.reportedBy?.firstName} {ncr.reportedBy?.lastName}</span>
                  <span className="text-xs text-gray-400 capitalize">{ncr.status?.replace(/_/g, ' ')}</span>
                </div>
              </button>
            ))}
          </div>
        )
      )}

      {/* ===== NCR DETAIL ===== */}
      {tab === 'ncr' && view === 'detail' && selectedNcr && (
        <div>
          <button onClick={() => { setView('list'); setSelectedNcr(null); }} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 mb-4">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedNcr.title}</h2>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${SEVERITY_BADGE[selectedNcr.severity]}`}>
                {selectedNcr.severity}
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 capitalize">
                {selectedNcr.status?.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Description</h3>
              <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{selectedNcr.description}</p>
            </div>
            {selectedNcr.rootCause && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Root Cause</h3>
                <p className="text-sm text-gray-800 dark:text-gray-200">{selectedNcr.rootCause}</p>
              </div>
            )}
            {selectedNcr.correctiveAction && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Corrective Action</h3>
                <p className="text-sm text-gray-800 dark:text-gray-200">{selectedNcr.correctiveAction}</p>
              </div>
            )}
            {/* Attachments */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Attachments</h3>
              {(selectedNcr as any).attachments?.length > 0 && (
                <div className="space-y-2 mb-3">
                  {((selectedNcr as any).attachments || []).map((att: any) => (
                    <div key={att.id} className="flex items-center gap-2 text-sm">
                      <a href={att.fileUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline truncate">
                        {att.fileName}
                      </a>
                    </div>
                  ))}
                </div>
              )}
              <FileUpload
                func="quality"
                label="Add attachment"
                accept="image/*,.pdf,.doc,.docx"
                onUpload={async (url, fileName) => {
                  try {
                    await api.post(`/quality/ncr/${selectedNcr.id}/attachments`, { fileUrl: url, fileName });
                    // Refresh NCR detail
                    const fresh = await api.get<NCR>(`/quality/ncr/${selectedNcr.id}`);
                    setSelectedNcr(fresh);
                    setNcrs(prev => prev.map(n => n.id === fresh.id ? fresh : n));
                  } catch {}
                }}
              />
            </div>

            {/* Status transitions */}
            {selectedNcr.status !== 'verified' && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Advance Status</h3>
                <div className="flex flex-wrap gap-2">
                  {NCR_STATUSES.filter(s => {
                    const ci = NCR_STATUSES.indexOf(selectedNcr.status);
                    if (ci === -1) return false; // unknown status — no transitions
                    const si = NCR_STATUSES.indexOf(s);
                    return si === ci + 1;
                  }).map(ns => (
                    <button key={ns} onClick={async () => {
                      try {
                        const updated = await api.patch<NCR>(`/quality/ncr/${selectedNcr.id}`, { status: ns });
                        setSelectedNcr(updated);
                        setNcrs(prev => prev.map(n => n.id === updated.id ? updated : n));
                      } catch (e: any) { setError(e.message); }
                    }}
                      className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 capitalize"
                    >
                      {ns.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== CREATE NCR ===== */}
      {tab === 'ncr' && view === 'create' && (
        <div>
          <button onClick={() => setView('list')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 mb-4">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Report Non-Conformance</h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-lg">
            <label className="block mb-4">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Title *</span>
              <input type="text" value={ncrTitle} onChange={e => setNcrTitle(e.target.value)}
                placeholder="Short description of the issue"
                className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
              />
            </label>
            <label className="block mb-4">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Description *</span>
              <textarea value={ncrDesc} onChange={e => setNcrDesc(e.target.value)} rows={4}
                placeholder="What happened? Where? When?"
                className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
              />
            </label>
            <label className="block mb-6">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Severity *</span>
              <select value={ncrSeverity} onChange={e => setNcrSeverity(e.target.value as any)}
                className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
              >
                <option value="minor">Minor</option>
                <option value="major">Major</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <button onClick={createNcr} disabled={creating || !ncrTitle.trim() || !ncrDesc.trim()}
              className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium"
            >
              {creating ? 'Submitting...' : 'Submit NCR'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
