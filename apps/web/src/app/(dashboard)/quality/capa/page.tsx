'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  Plus, ChevronLeft, X, Check, ChevronRight,
  Shield, ShieldAlert, AlertTriangle, Clock, CheckCircle,
  XCircle, ArrowRight, Users, Calendar,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';

// ===== TYPES =====
interface CAPA {
  id: string;
  capaNumber: string;
  type: 'corrective' | 'preventive';
  title: string;
  description: string;
  rootCause: string | null;
  status: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  actionTaken: string | null;
  verificationMethod: string | null;
  verificationDate: string | null;
  effectivenessCheck: string | null;
  effectivenessResult: string | null;
  dueDate: string | null;
  ncrId: string | null;
  ncr?: { id: string; title: string } | null;
  assigneeId: string | null;
  assignee?: { id: string; firstName: string; lastName: string } | null;
  createdBy?: { firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

interface NCROption {
  id: string;
  title: string;
}

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface CAPASummary {
  open: number;
  in_progress: number;
  verification: number;
  closed: number;
}

type View = 'list' | 'detail' | 'create';

// ===== CONSTANTS =====
const STATUSES = ['open', 'in_progress', 'implemented', 'verification', 'effective', 'ineffective'];
const STATUS_STEPS = ['open', 'in_progress', 'implemented', 'verification', 'effective'];

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  open: { label: 'Open', color: 'text-gray-700 dark:text-gray-300', bgColor: 'bg-gray-100 dark:bg-gray-700' },
  in_progress: { label: 'In Progress', color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  implemented: { label: 'Implemented', color: 'text-purple-700 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
  verification: { label: 'Verification', color: 'text-amber-700 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  effective: { label: 'Effective / Closed', color: 'text-green-700 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  ineffective: { label: 'Ineffective', color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
};

const TYPE_BADGE: Record<string, string> = {
  corrective: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  preventive: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

const PRIORITY_BADGE: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function CAPAPage() {
  const [view, setView] = useState<View>('list');
  const [capas, setCAPAs] = useState<CAPA[]>([]);
  const [summary, setSummary] = useState<CAPASummary>({ open: 0, in_progress: 0, verification: 0, closed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCapa, setSelectedCapa] = useState<CAPA | null>(null);
  const { toast } = useToast();

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');

  // Form state
  const [formType, setFormType] = useState<'corrective' | 'preventive'>('corrective');
  const [formNcrId, setFormNcrId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formRootCause, setFormRootCause] = useState('');
  const [formAssigneeId, setFormAssigneeId] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formPriority, setFormPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [formActionTaken, setFormActionTaken] = useState('');
  const [formVerificationMethod, setFormVerificationMethod] = useState('');
  const [creating, setCreating] = useState(false);

  // Verification form (for verification step)
  const [verMethod, setVerMethod] = useState('');
  const [verDate, setVerDate] = useState('');
  const [verEffectivenessCheck, setVerEffectivenessCheck] = useState('');
  const [verResult, setVerResult] = useState<'effective' | 'ineffective' | 'partial'>('effective');

  // Dropdowns
  const [ncrs, setNcrs] = useState<NCROption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [capaRes, summaryRes] = await Promise.all([
        api.get<any>('/capa').catch(() => []),
        api.get<CAPASummary>('/capa/summary').catch(() => ({ open: 0, in_progress: 0, verification: 0, closed: 0 })),
      ]);
      setCAPAs(Array.isArray(capaRes) ? capaRes : capaRes?.data || []);
      setSummary(summaryRes as CAPASummary);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDropdowns = useCallback(async () => {
    const [ncrRes, userRes] = await Promise.all([
      api.get<any>('/quality/ncr').catch(() => []),
      api.get<any>('/users').catch(() => []),
    ]);
    setNcrs(Array.isArray(ncrRes) ? ncrRes : ncrRes?.data || []);
    setUsers(Array.isArray(userRes) ? userRes : userRes?.data || []);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const resetForm = () => {
    setFormType('corrective');
    setFormNcrId('');
    setFormTitle('');
    setFormDesc('');
    setFormRootCause('');
    setFormAssigneeId('');
    setFormDueDate('');
    setFormPriority('medium');
    setFormActionTaken('');
    setFormVerificationMethod('');
  };

  const openCreate = () => {
    resetForm();
    loadDropdowns();
    setView('create');
    setError('');
  };

  const openDetail = async (capa: CAPA) => {
    setSelectedCapa(capa);
    setView('detail');
    try {
      const full = await api.get<CAPA>(`/capa/${capa.id}`);
      setSelectedCapa(full);
    } catch {}
  };

  // Create CAPA
  const createCapa = async () => {
    if (!formTitle.trim()) return;
    setCreating(true);
    setError('');
    try {
      const payload: any = {
        type: formType,
        title: formTitle.trim(),
        description: formDesc.trim(),
        rootCause: formRootCause.trim() || undefined,
        priority: formPriority,
        actionTaken: formActionTaken.trim() || undefined,
        verificationMethod: formVerificationMethod.trim() || undefined,
        dueDate: formDueDate || undefined,
        ncrId: formNcrId || undefined,
        assigneeId: formAssigneeId || undefined,
      };
      const created = await api.post<CAPA>('/capa', payload);
      setCAPAs(prev => [created, ...prev]);
      setView('list');
      resetForm();
      toast('success', 'CAPA created');
      loadAll();
    } catch (e: any) {
      setError(e.message || 'Failed to create CAPA');
    } finally {
      setCreating(false);
    }
  };

  // Advance status
  const advanceStatus = async (capaId: string, newStatus: string, extraPayload?: any) => {
    try {
      const updated = await api.patch<CAPA>(`/capa/${capaId}`, { status: newStatus, ...extraPayload });
      setSelectedCapa(updated);
      setCAPAs(prev => prev.map(c => c.id === updated.id ? updated : c));
      toast('success', `Status updated to ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
      loadAll();
    } catch (e: any) {
      setError(e.message || 'Failed to update status');
    }
  };

  // Filtered list
  const filtered = capas.filter(c => {
    if (filterStatus && c.status !== filterStatus) return false;
    if (filterType && c.type !== filterType) return false;
    return true;
  });

  // Status step index helper
  const getStepIdx = (status: string) => {
    const idx = STATUS_STEPS.indexOf(status);
    if (status === 'ineffective') return 3; // stays at verification level
    return idx >= 0 ? idx : 0;
  };

  return (
    <div className="p-6">
      <Breadcrumb items={[
        { label: 'Quality', onClick: () => window.history.back() },
        { label: 'CAPA Register' },
      ]} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">CAPA Register</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Corrective and Preventive Actions
          </p>
        </div>
        {view === 'list' && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New CAPA
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
          <span className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</span>
          <button onClick={() => setError('')} aria-label="Dismiss error"><X className="w-4 h-4 text-red-400" /></button>
        </div>
      )}

      {/* ===== LIST VIEW ===== */}
      {view === 'list' && (
        <>
          {/* Summary bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Open', count: summary.open, color: 'text-gray-600 dark:text-gray-300', bg: 'bg-gray-50 dark:bg-gray-800' },
              { label: 'In Progress', count: summary.in_progress, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
              { label: 'Verification', count: summary.verification, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
              { label: 'Closed', count: summary.closed, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-xl border border-gray-200 dark:border-gray-700 p-4`}>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.count}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
            >
              <option value="">All Statuses</option>
              {STATUSES.map(s => (
                <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
              ))}
            </select>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
            >
              <option value="">All Types</option>
              <option value="corrective">Corrective</option>
              <option value="preventive">Preventive</option>
            </select>
          </div>

          {loading && <SkeletonList count={4} />}

          {!loading && filtered.length === 0 && (
            <EmptyState
              icon={Shield}
              title="No CAPAs found"
              description={filterStatus || filterType ? 'Try adjusting your filters.' : 'Create your first CAPA to start tracking corrective and preventive actions.'}
            />
          )}

          {!loading && filtered.length > 0 && (
            <div className="grid gap-3">
              {filtered.map(capa => (
                <Card key={capa.id} hover onClick={() => openDetail(capa)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-mono font-semibold text-gray-400 dark:text-gray-500">
                          {capa.capaNumber}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${TYPE_BADGE[capa.type]}`}>
                          {capa.type}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${PRIORITY_BADGE[capa.priority]}`}>
                          {capa.priority}
                        </span>
                      </div>
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">{capa.title}</h3>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 dark:text-gray-500">
                        {capa.ncr && (
                          <span>NCR: {capa.ncr.title}</span>
                        )}
                        {capa.assignee && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {capa.assignee.firstName} {capa.assignee.lastName}
                          </span>
                        )}
                        {capa.dueDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(capa.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_CONFIG[capa.status]?.bgColor || ''} ${STATUS_CONFIG[capa.status]?.color || ''}`}>
                      {STATUS_CONFIG[capa.status]?.label || capa.status}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ===== CREATE VIEW ===== */}
      {view === 'create' && (
        <div>
          <button onClick={() => { setView('list'); resetForm(); }} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 mb-4">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">New CAPA</h2>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-2xl">
            {/* Type selection */}
            <div className="mb-5">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">Type *</span>
              <div className="flex gap-3">
                {(['corrective', 'preventive'] as const).map(t => (
                  <label key={t} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-all ${
                    formType === t
                      ? t === 'corrective'
                        ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20'
                        : 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}>
                    <input
                      type="radio"
                      name="capaType"
                      value={t}
                      checked={formType === t}
                      onChange={() => setFormType(t)}
                      className="sr-only"
                    />
                    {t === 'corrective' ? <ShieldAlert className="w-4 h-4 text-red-500" /> : <Shield className="w-4 h-4 text-blue-500" />}
                    <span className="text-sm font-medium capitalize text-gray-900 dark:text-white">{t}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Link to NCR */}
            <label className="block mb-4">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Link to NCR</span>
              <select value={formNcrId} onChange={e => setFormNcrId(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
              >
                <option value="">-- None --</option>
                {ncrs.map(n => (
                  <option key={n.id} value={n.id}>{n.title}</option>
                ))}
              </select>
            </label>

            {/* Title */}
            <label className="block mb-4">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Title *</span>
              <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)}
                placeholder="Brief description of the corrective/preventive action"
                className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
              />
            </label>

            {/* Description */}
            <label className="block mb-4">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</span>
              <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={3}
                placeholder="Detailed description of the issue and required action"
                className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
              />
            </label>

            {/* Root Cause */}
            <label className="block mb-4">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Root Cause</span>
              <textarea value={formRootCause} onChange={e => setFormRootCause(e.target.value)} rows={2}
                placeholder="Identified root cause of the issue"
                className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
              />
            </label>

            {/* Assignee */}
            <label className="block mb-4">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Assignee</span>
              <select value={formAssigneeId} onChange={e => setFormAssigneeId(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
              >
                <option value="">-- Unassigned --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                ))}
              </select>
            </label>

            {/* Due Date */}
            <label className="block mb-4">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Due Date</span>
              <input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
              />
            </label>

            {/* Priority */}
            <label className="block mb-4">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Priority</span>
              <select value={formPriority} onChange={e => setFormPriority(e.target.value as any)}
                className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>

            {/* Action Taken */}
            <label className="block mb-4">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Action Taken</span>
              <textarea value={formActionTaken} onChange={e => setFormActionTaken(e.target.value)} rows={2}
                placeholder="Describe actions taken (can be filled during investigation)"
                className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
              />
            </label>

            {/* Verification Method */}
            <label className="block mb-6">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Verification Method</span>
              <textarea value={formVerificationMethod} onChange={e => setFormVerificationMethod(e.target.value)} rows={2}
                placeholder="How will effectiveness be verified?"
                className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
              />
            </label>

            <button onClick={createCapa} disabled={creating || !formTitle.trim()}
              className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {creating ? 'Creating...' : 'Create CAPA'}
            </button>
          </div>
        </div>
      )}

      {/* ===== DETAIL VIEW ===== */}
      {view === 'detail' && selectedCapa && (
        <div>
          <button onClick={() => { setView('list'); setSelectedCapa(null); }} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 mb-4">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>

          <div className="flex items-start justify-between mb-6 gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-mono font-semibold text-gray-400">{selectedCapa.capaNumber}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${TYPE_BADGE[selectedCapa.type]}`}>
                  {selectedCapa.type}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${PRIORITY_BADGE[selectedCapa.priority]}`}>
                  {selectedCapa.priority}
                </span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedCapa.title}</h2>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ${STATUS_CONFIG[selectedCapa.status]?.bgColor || ''} ${STATUS_CONFIG[selectedCapa.status]?.color || ''}`}>
              {STATUS_CONFIG[selectedCapa.status]?.label || selectedCapa.status}
            </span>
          </div>

          {/* Status stepper */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-4">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Progress</h3>
            <div className="flex items-center gap-1 overflow-x-auto">
              {STATUS_STEPS.map((step, i) => {
                const currentIdx = getStepIdx(selectedCapa.status);
                const isActive = i === currentIdx;
                const isDone = i < currentIdx;
                const isIneffective = selectedCapa.status === 'ineffective' && i === 3;
                return (
                  <div key={step} className="flex items-center flex-1 min-w-0">
                    <div className={`flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0 text-xs font-bold transition-colors ${
                      isIneffective ? 'bg-red-500 text-white' :
                      isDone ? 'bg-green-500 text-white' :
                      isActive ? 'bg-brand-600 text-white ring-2 ring-brand-300' :
                      'bg-gray-200 dark:bg-gray-600 text-gray-400 dark:text-gray-500'
                    }`}>
                      {isIneffective ? <XCircle className="w-4 h-4" /> :
                       isDone ? <Check className="w-4 h-4" /> : i + 1}
                    </div>
                    <span className={`ml-1.5 text-[11px] font-medium truncate hidden sm:block ${
                      isActive || isDone ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {STATUS_CONFIG[step]?.label || step}
                    </span>
                    {i < STATUS_STEPS.length - 1 && (
                      <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0 mx-1" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detail fields */}
          <div className="space-y-4">
            {selectedCapa.description && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Description</h3>
                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{selectedCapa.description}</p>
              </div>
            )}

            {selectedCapa.rootCause && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Root Cause</h3>
                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{selectedCapa.rootCause}</p>
              </div>
            )}

            {selectedCapa.ncr && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Linked NCR</h3>
                <p className="text-sm text-gray-800 dark:text-gray-200">{selectedCapa.ncr.title}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {selectedCapa.assignee && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Assignee</h3>
                  <p className="text-sm text-gray-800 dark:text-gray-200">{selectedCapa.assignee.firstName} {selectedCapa.assignee.lastName}</p>
                </div>
              )}
              {selectedCapa.dueDate && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Due Date</h3>
                  <p className="text-sm text-gray-800 dark:text-gray-200">{new Date(selectedCapa.dueDate).toLocaleDateString()}</p>
                </div>
              )}
            </div>

            {selectedCapa.actionTaken && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Action Taken</h3>
                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{selectedCapa.actionTaken}</p>
              </div>
            )}

            {selectedCapa.verificationMethod && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Verification Method</h3>
                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{selectedCapa.verificationMethod}</p>
              </div>
            )}

            {(selectedCapa.effectivenessResult || selectedCapa.verificationDate) && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Verification Result</h3>
                {selectedCapa.verificationDate && (
                  <p className="text-sm text-gray-500 mb-1">Date: {new Date(selectedCapa.verificationDate).toLocaleDateString()}</p>
                )}
                {selectedCapa.effectivenessCheck && (
                  <p className="text-sm text-gray-800 dark:text-gray-200 mb-1">{selectedCapa.effectivenessCheck}</p>
                )}
                {selectedCapa.effectivenessResult && (
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                    selectedCapa.effectivenessResult === 'effective' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    selectedCapa.effectivenessResult === 'ineffective' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {selectedCapa.effectivenessResult}
                  </span>
                )}
              </div>
            )}

            {/* Status transition buttons */}
            {selectedCapa.status !== 'effective' && selectedCapa.status !== 'ineffective' && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Advance Status</h3>

                {/* Verification step: special form */}
                {selectedCapa.status === 'verification' ? (
                  <div className="space-y-4">
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Verification Method</span>
                      <textarea value={verMethod} onChange={e => setVerMethod(e.target.value)} rows={2}
                        placeholder="How was effectiveness verified?"
                        className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Verification Date</span>
                      <input type="date" value={verDate} onChange={e => setVerDate(e.target.value)}
                        className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Effectiveness Check Description</span>
                      <textarea value={verEffectivenessCheck} onChange={e => setVerEffectivenessCheck(e.target.value)} rows={2}
                        placeholder="Describe the effectiveness check performed"
                        className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Effectiveness Result</span>
                      <select value={verResult} onChange={e => setVerResult(e.target.value as any)}
                        className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                      >
                        <option value="effective">Effective</option>
                        <option value="ineffective">Ineffective</option>
                        <option value="partial">Partial</option>
                      </select>
                    </label>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          const newStatus = verResult === 'ineffective' ? 'ineffective' : 'effective';
                          advanceStatus(selectedCapa.id, newStatus, {
                            verificationMethod: verMethod || undefined,
                            verificationDate: verDate || undefined,
                            effectivenessCheck: verEffectivenessCheck || undefined,
                            effectivenessResult: verResult,
                          });
                        }}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium text-white transition-colors ${
                          verResult === 'ineffective'
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-green-600 hover:bg-green-700'
                        }`}
                      >
                        {verResult === 'ineffective' ? 'Mark as Ineffective' : 'Mark as Effective / Close'}
                      </button>
                    </div>
                    {verResult === 'ineffective' && (
                      <p className="text-xs text-red-500 dark:text-red-400">
                        Marking as ineffective will require a new CAPA to be created.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const currentIdx = STATUS_STEPS.indexOf(selectedCapa.status);
                      const nextStatus = currentIdx >= 0 && currentIdx < STATUS_STEPS.length - 1 ? STATUS_STEPS[currentIdx + 1] : null;
                      if (!nextStatus) return null;
                      return (
                        <button
                          onClick={() => advanceStatus(selectedCapa.id, nextStatus)}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <ArrowRight className="w-4 h-4" />
                          Move to {STATUS_CONFIG[nextStatus]?.label || nextStatus}
                        </button>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {selectedCapa.status === 'ineffective' && (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="w-5 h-5 text-red-500" />
                  <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Ineffective</h3>
                </div>
                <p className="text-sm text-red-600 dark:text-red-400 mb-3">
                  This CAPA was determined to be ineffective. A new CAPA should be created to address the underlying issue.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
