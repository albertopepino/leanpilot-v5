'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api, auth } from '@/lib/api';
import {
  PackageCheck, Plus, ChevronRight, Search, X, ArrowLeft, Download,
  Clock, AlertTriangle, Calendar, Hash, Layers, Play,
  CheckCircle2, Archive, FileText, Trash2,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { GlassCard } from '@/components/ui/GlassCard';
import { exportToCSV } from '@/lib/csv-export';
import { useTranslations } from 'next-intl';

// ===== TYPES =====

interface OrderPhase {
  id: string;
  sequence: number;
  name: string;
  workstationId: string;
  cycleTimeSeconds: number;
  status: string;
  workstation?: { name: string; code: string };
  runs?: Array<{
    id: string;
    startedAt: string;
    operator?: { firstName: string; lastName: string };
  }>;
}

interface ProductionOrder {
  id: string;
  poNumber: string;
  productName: string;
  targetQuantity: number;
  unit: string;
  status: string;
  priority: string;
  dueDate: string | null;
  notes: string | null;
  phases: OrderPhase[];
  createdAt: string;
  updatedAt: string;
}

interface Workstation {
  id: string;
  name: string;
  code: string;
}

// ===== CONSTANTS =====

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  released: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  closed: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  released: 'Released',
  in_progress: 'In Progress',
  completed: 'Completed',
  closed: 'Closed',
};

const PRIORITY_BADGE: Record<string, string> = {
  normal: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const PRIORITY_LABEL: Record<string, string> = {
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

const STATUS_TABS = ['all', 'released', 'in_progress', 'completed'] as const;

type View = 'list' | 'detail' | 'create';

// ===== COMPONENT =====

export default function OrdersPage() {
  const t = useTranslations('orders');
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('list');
  const [selected, setSelected] = useState<ProductionOrder | null>(null);
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const { toast } = useToast();
  const user = auth.getUser();
  const isManager = user && ['manager', 'site_admin', 'corporate_admin'].includes(user.role);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const searchTimer = useRef<NodeJS.Timeout>(undefined);

  useEffect(() => {
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  // Create form
  const [formPoNumber, setFormPoNumber] = useState('');
  const [formProductName, setFormProductName] = useState('');
  const [formTargetQty, setFormTargetQty] = useState('');
  const [formUnit, setFormUnit] = useState('pcs');
  const [formDueDate, setFormDueDate] = useState('');
  const [formPriority, setFormPriority] = useState('normal');
  const [formNotes, setFormNotes] = useState('');
  const [formPhases, setFormPhases] = useState<Array<{ name: string; workstationId: string; cycleTimeSeconds: string }>>([]);
  const [saving, setSaving] = useState(false);

  // ===== DATA LOADING =====

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>('/orders');
      setOrders(Array.isArray(res) ? res : res?.data || []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWorkstations = useCallback(async () => {
    try {
      const res = await api.get<any>('/workstations');
      setWorkstations(Array.isArray(res) ? res : res?.data || []);
    } catch {
      setWorkstations([]);
    }
  }, []);

  useEffect(() => { loadOrders(); loadWorkstations(); }, [loadOrders, loadWorkstations]);

  // ===== FILTERED LIST =====

  const filtered = orders.filter(o => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      return o.poNumber.toLowerCase().includes(q) || o.productName.toLowerCase().includes(q);
    }
    return true;
  });

  // ===== ACTIONS =====

  const openDetail = async (order: ProductionOrder) => {
    try {
      const detail = await api.get<ProductionOrder>(`/orders/${order.id}`);
      setSelected(detail);
      setView('detail');
    } catch {
      toast('error', 'Failed to load order details');
    }
  };

  const openCreate = () => {
    setFormPoNumber('');
    setFormProductName('');
    setFormTargetQty('');
    setFormUnit('pcs');
    setFormDueDate('');
    setFormPriority('normal');
    setFormNotes('');
    setFormPhases([]);
    setView('create');
  };

  const addPhase = () => {
    setFormPhases(prev => [...prev, { name: '', workstationId: '', cycleTimeSeconds: '' }]);
  };

  const updatePhase = (index: number, field: string, value: string) => {
    setFormPhases(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const removePhase = (index: number) => {
    setFormPhases(prev => prev.filter((_, i) => i !== index));
  };

  const createOrder = async () => {
    if (!formPoNumber.trim() || !formProductName.trim() || !formTargetQty) return;
    setSaving(true);
    try {
      const phases = formPhases
        .filter(p => p.name.trim() && p.workstationId)
        .map((p, i) => ({
          sequence: i + 1,
          name: p.name.trim(),
          workstationId: p.workstationId,
          cycleTimeSeconds: Number(p.cycleTimeSeconds) || 0,
        }));

      await api.post('/orders', {
        poNumber: formPoNumber.trim(),
        productName: formProductName.trim(),
        targetQuantity: Number(formTargetQty),
        unit: formUnit,
        dueDate: formDueDate || undefined,
        priority: formPriority,
        notes: formNotes.trim() || undefined,
        phases: phases.length > 0 ? phases : undefined,
      });

      toast('success', 'Production order created');
      setView('list');
      loadOrders();
    } catch (e: any) {
      toast('error', e.message || 'Failed to create order');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // ===== RENDER: CREATE =====

  if (view === 'create') {
    return (
      <div className="px-6 py-6 max-w-4xl mx-auto space-y-6">
        <Breadcrumb items={[
          { label: t('title'), onClick: () => setView('list') },
          { label: t('newOrder') },
        ]} />

        <GlassCard>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">{t('createOrder')}</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">PO Number *</label>
              <input
                type="text"
                value={formPoNumber}
                onChange={e => setFormPoNumber(e.target.value)}
                placeholder="PO-2026-001"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600
                  bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white
                  focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Product Name *</label>
              <input
                type="text"
                value={formProductName}
                onChange={e => setFormProductName(e.target.value)}
                placeholder="Widget Assembly A"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600
                  bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white
                  focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Target Quantity *</label>
              <input
                type="number"
                value={formTargetQty}
                onChange={e => setFormTargetQty(e.target.value)}
                placeholder="1000"
                min="1"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600
                  bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white
                  focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Unit</label>
              <select
                value={formUnit}
                onChange={e => setFormUnit(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600
                  bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white
                  focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              >
                <option value="pcs">pcs</option>
                <option value="kg">kg</option>
                <option value="m">m</option>
                <option value="l">l</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label>
              <input
                type="date"
                value={formDueDate}
                onChange={e => setFormDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600
                  bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white
                  focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
              <select
                value={formPriority}
                onChange={e => setFormPriority(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600
                  bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white
                  focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              >
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <textarea
              value={formNotes}
              onChange={e => setFormNotes(e.target.value)}
              rows={3}
              placeholder="Optional notes..."
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600
                bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white
                focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
            />
          </div>

          {/* Phases */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">Phases</label>
              <button
                onClick={addPhase}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Phase
              </button>
            </div>

            {formPhases.length === 0 && (
              <p className="text-sm text-gray-400 italic">No phases added yet. Click "Add Phase" to define the routing.</p>
            )}

            <div className="space-y-3">
              {formPhases.map((phase, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50/80 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400 mt-1">
                    {i + 1}
                  </span>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={phase.name}
                      onChange={e => updatePhase(i, 'name', e.target.value)}
                      placeholder="Phase name"
                      className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600
                        bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white
                        focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                    <select
                      value={phase.workstationId}
                      onChange={e => updatePhase(i, 'workstationId', e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600
                        bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white
                        focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    >
                      <option value="">Select workstation</option>
                      {workstations.map(ws => (
                        <option key={ws.id} value={ws.id}>{ws.name} ({ws.code})</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={phase.cycleTimeSeconds}
                        onChange={e => updatePhase(i, 'cycleTimeSeconds', e.target.value)}
                        placeholder="Cycle time (s)"
                        min="0"
                        className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600
                          bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white
                          focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                      <button
                        onClick={() => removePhase(i)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50
                          dark:hover:bg-red-900/20 transition-all flex-shrink-0"
                        aria-label="Remove phase"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={createOrder}
              disabled={saving || !formPoNumber.trim() || !formProductName.trim() || !formTargetQty}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium
                shadow-sm shadow-blue-500/20 hover:shadow-md hover:shadow-blue-500/30
                disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {saving ? '...' : t('createOrder')}
            </button>
            <button
              onClick={() => setView('list')}
              className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium
                hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
            >
              Cancel
            </button>
          </div>
        </GlassCard>
      </div>
    );
  }

  // ===== RENDER: DETAIL =====

  if (view === 'detail' && selected) {
    return (
      <div className="px-6 py-6 max-w-5xl mx-auto space-y-6">
        <Breadcrumb items={[
          { label: t('title'), onClick: () => { setView('list'); setSelected(null); } },
          { label: selected.poNumber },
        ]} />

        {/* Header */}
        <GlassCard>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selected.poNumber}</h2>
                <span className={`px-2.5 py-0.5 text-[11px] font-bold uppercase rounded-full ${STATUS_BADGE[selected.status] || STATUS_BADGE.draft}`}>
                  {STATUS_LABEL[selected.status] || selected.status}
                </span>
                <span className={`px-2.5 py-0.5 text-[11px] font-bold uppercase rounded-full ${PRIORITY_BADGE[selected.priority] || PRIORITY_BADGE.normal}`}>
                  {PRIORITY_LABEL[selected.priority] || selected.priority}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{selected.productName}</p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Target</p>
                <p className="font-bold text-gray-900 dark:text-white tabular-nums">{selected.targetQuantity} {selected.unit}</p>
              </div>
              {selected.dueDate && (
                <div className="text-right pl-3 border-l border-gray-200 dark:border-gray-700">
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Due</p>
                  <p className="font-medium text-gray-700 dark:text-gray-200">{formatDate(selected.dueDate)}</p>
                </div>
              )}
            </div>
          </div>

          {selected.notes && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Notes</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">{selected.notes}</p>
            </div>
          )}
        </GlassCard>

        {/* Phases */}
        <GlassCard>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600
                            flex items-center justify-center shadow-sm shadow-blue-500/20">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Phases</h3>
              <p className="text-[11px] text-gray-400">{selected.phases?.length || 0} phase{(selected.phases?.length || 0) !== 1 ? 's' : ''} defined</p>
            </div>
          </div>

          {!selected.phases || selected.phases.length === 0 ? (
            <p className="text-sm text-gray-400 italic py-4">No phases defined for this order.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400">
                    <th className="pb-2 font-medium w-12">#</th>
                    <th className="pb-2 font-medium">Phase</th>
                    <th className="pb-2 font-medium">Workstation</th>
                    <th className="pb-2 font-medium text-right">Cycle Time</th>
                    <th className="pb-2 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {selected.phases.map((phase) => (
                    <tr key={phase.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20">
                      <td className="py-2.5 text-gray-400 font-mono text-xs">{phase.sequence}</td>
                      <td className="py-2.5 font-medium text-gray-700 dark:text-gray-200">{phase.name}</td>
                      <td className="py-2.5 text-gray-600 dark:text-gray-300">
                        {phase.workstation?.name || '—'}
                        {phase.workstation?.code && (
                          <span className="ml-1.5 text-[10px] text-gray-400">({phase.workstation.code})</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right text-gray-600 dark:text-gray-300 tabular-nums">
                        {phase.cycleTimeSeconds}s
                      </td>
                      <td className="py-2.5 text-right">
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full
                          ${STATUS_BADGE[phase.status] || STATUS_BADGE.draft}`}>
                          {STATUS_LABEL[phase.status] || phase.status || 'pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>

        <button
          onClick={() => { setView('list'); setSelected(null); }}
          className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Orders
        </button>
      </div>
    );
  }

  // ===== RENDER: LIST =====

  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto space-y-6">
      <Breadcrumb items={[{ label: t('title') }]} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500
                          flex items-center justify-center shadow-md shadow-blue-500/20">
            <PackageCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
            <p className="text-xs text-gray-400">{orders.length} order{orders.length !== 1 ? 's' : ''} total</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportToCSV(orders.map(o => ({
              'PO Number': o.poNumber,
              Product: o.productName,
              'Target Qty': o.targetQuantity,
              Unit: o.unit,
              Status: o.status,
              Priority: o.priority,
              'Due Date': o.dueDate ? new Date(o.dueDate).toLocaleDateString() : '',
            })), 'production-orders')}
            disabled={orders.length === 0}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-40"
            title="Export CSV"
          >
            <Download className="w-4 h-4" />
          </button>
          {isManager && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl
                bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium
                shadow-sm shadow-blue-500/20 hover:shadow-md hover:shadow-blue-500/30
                transition-all"
            >
              <Plus className="w-4 h-4" /> {t('newOrder')}
            </button>
          )}
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-1 p-1 bg-gray-100/80 dark:bg-gray-800/80 rounded-xl w-fit">
        {STATUS_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all
              ${statusFilter === tab
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
          >
            {tab === 'all' ? 'All' : STATUS_LABEL[tab] || tab}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by PO# or product..."
          className="w-full pl-10 pr-9 py-2 rounded-xl border border-gray-200 dark:border-gray-600
            bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white
            focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <SkeletonList count={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title="No orders found"
          description={search ? 'Try adjusting your search.' : 'Create your first production order to get started.'}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="pb-3 font-medium">PO#</th>
                <th className="pb-3 font-medium">Product</th>
                <th className="pb-3 font-medium text-right">Target Qty</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Priority</th>
                <th className="pb-3 font-medium">Due Date</th>
                <th className="pb-3 font-medium w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {filtered.map(order => (
                <tr
                  key={order.id}
                  onClick={() => openDetail(order)}
                  className="hover:bg-gray-50/80 dark:hover:bg-gray-700/20 cursor-pointer group transition-colors"
                >
                  <td className="py-3 font-mono font-semibold text-gray-900 dark:text-white">{order.poNumber}</td>
                  <td className="py-3 text-gray-700 dark:text-gray-200">{order.productName}</td>
                  <td className="py-3 text-right text-gray-600 dark:text-gray-300 tabular-nums">
                    {order.targetQuantity} {order.unit}
                  </td>
                  <td className="py-3">
                    <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full ${STATUS_BADGE[order.status] || STATUS_BADGE.draft}`}>
                      {STATUS_LABEL[order.status] || order.status}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full ${PRIORITY_BADGE[order.priority] || PRIORITY_BADGE.normal}`}>
                      {PRIORITY_LABEL[order.priority] || order.priority}
                    </span>
                  </td>
                  <td className="py-3 text-gray-500 dark:text-gray-400">{formatDate(order.dueDate)}</td>
                  <td className="py-3">
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
