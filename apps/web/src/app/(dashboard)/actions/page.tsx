'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  CheckSquare, Plus, X, Filter, Clock, AlertTriangle,
  ChevronDown, ChevronRight, Loader2, Calendar, UserIcon,
  TrendingUp,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';

// ── Types ──────────────────────────────────────────────────────────────

interface Action {
  id: string;
  title: string;
  description?: string;
  category: 'safety' | 'quality' | 'delivery' | 'cost' | 'people';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'completed' | 'overdue';
  source?: string;
  sourceId?: string;
  dueDate?: string;
  completedAt?: string;
  assignee?: { id: string; firstName: string; lastName: string } | null;
  createdAt: string;
  updatedAt: string;
}

interface ActionSummary {
  totalOpen: number;
  overdueCount: number;
  completedThisWeek: number;
  byCategory: Record<string, number>;
}

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
}

// ── Constants ──────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'safety', label: 'S', fullLabel: 'Safety', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', border: 'border-red-500' },
  { value: 'quality', label: 'Q', fullLabel: 'Quality', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', border: 'border-emerald-500' },
  { value: 'delivery', label: 'D', fullLabel: 'Delivery', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', border: 'border-blue-500' },
  { value: 'cost', label: 'C', fullLabel: 'Cost', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', border: 'border-amber-500' },
  { value: 'people', label: 'P', fullLabel: 'People', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', border: 'border-purple-500' },
] as const;

const PRIORITIES: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const STATUSES = ['open', 'in_progress', 'completed', 'overdue'] as const;

// ── Page ───────────────────────────────────────────────────────────────

export default function ActionsPage() {
  const [actions, setActions] = useState<Action[]>([]);
  const [summary, setSummary] = useState<ActionSummary | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { toast } = useToast();

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createCategory, setCreateCategory] = useState<string>('safety');
  const [createPriority, setCreatePriority] = useState<string>('medium');
  const [createAssignee, setCreateAssignee] = useState('');
  const [createDueDate, setCreateDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Expanded action
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<string>('');

  const loadActions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterCategory) params.set('category', filterCategory);
      const qs = params.toString();
      const res = await api.get<any>(`/actions${qs ? `?${qs}` : ''}`);
      setActions(Array.isArray(res) ? res : res?.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterCategory]);

  const loadSummary = useCallback(async () => {
    try {
      const data = await api.get<ActionSummary>('/actions/summary');
      setSummary(data);
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    loadActions();
    loadSummary();
    api.get<any>('/users').then(u => setUsers(Array.isArray(u) ? u : u?.data || [])).catch(() => {});
  }, [loadActions, loadSummary]);

  const createAction = async () => {
    if (!createTitle.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/actions', {
        title: createTitle.trim(),
        description: createDesc.trim() || undefined,
        category: createCategory,
        priority: createPriority,
        assigneeId: createAssignee || undefined,
        dueDate: createDueDate || undefined,
      });
      setCreateTitle('');
      setCreateDesc('');
      setCreateCategory('safety');
      setCreatePriority('medium');
      setCreateAssignee('');
      setCreateDueDate('');
      setShowCreate(false);
      toast('success', 'Action created');
      await loadActions();
      await loadSummary();
    } catch (e: any) {
      toast('error', e.message || 'Failed to create action');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/actions/${id}/status`, { status });
      toast('success', `Status updated to ${status.replace('_', ' ')}`);
      await loadActions();
      await loadSummary();
    } catch (e: any) {
      toast('error', e.message || 'Failed to update status');
    }
  };

  const isOverdue = (action: Action) => {
    return action.dueDate && !action.completedAt && new Date(action.dueDate) < new Date();
  };

  const getCategoryInfo = (cat: string) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[0];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-brand-600" />
            Action Tracker
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Track actions across all modules — SQDCP
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium text-sm"
        >
          <Plus className="w-4 h-4" /> New Action
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between">
          <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
          <button onClick={() => setError('')} aria-label="Dismiss error"><X className="w-4 h-4 text-red-400" /></button>
        </div>
      )}

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Open</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{summary.totalOpen}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs font-semibold text-red-400 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Overdue
            </p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{summary.overdueCount}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs font-semibold text-green-400 uppercase tracking-wider flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Done This Week
            </p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{summary.completedThisWeek}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">By Category</p>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {CATEGORIES.map(cat => {
                const count = summary.byCategory[cat.value] || 0;
                if (!count) return null;
                return (
                  <span key={cat.value} className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${cat.color}`}>
                    {cat.label}: {count}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
            showFilters || filterStatus || filterCategory
              ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
          {(filterStatus || filterCategory) && (
            <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-xs flex items-center justify-center">
              {(filterStatus ? 1 : 0) + (filterCategory ? 1 : 0)}
            </span>
          )}
        </button>
        {(filterStatus || filterCategory) && (
          <button
            onClick={() => { setFilterStatus(''); setFilterCategory(''); }}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Clear all
          </button>
        )}
      </div>

      {showFilters && (
        <div className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Status</label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterStatus('')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  !filterStatus ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700' : 'border-gray-200 dark:border-gray-700 text-gray-500'
                }`}
              >
                All
              </button>
              {STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize transition-colors ${
                    filterStatus === s ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700' : 'border-gray-200 dark:border-gray-700 text-gray-500'
                  }`}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Category (SQDCP)</label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterCategory('')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  !filterCategory ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700' : 'border-gray-200 dark:border-gray-700 text-gray-500'
                }`}
              >
                All
              </button>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => setFilterCategory(filterCategory === cat.value ? '' : cat.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    filterCategory === cat.value ? `${cat.color} ${cat.border}` : 'border-gray-200 dark:border-gray-700 text-gray-500'
                  }`}
                >
                  {cat.fullLabel}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {loading && <SkeletonList count={4} />}

      {/* Actions List */}
      {!loading && actions.length === 0 && (
        <EmptyState
          icon={CheckSquare}
          title="No actions found"
          description="Create your first action to start tracking improvement activities across modules."
          actionLabel="New Action"
          onAction={() => setShowCreate(true)}
        />
      )}

      {!loading && actions.length > 0 && (
        <div className="space-y-2">
          {actions.map(action => {
            const catInfo = getCategoryInfo(action.category);
            const overdue = isOverdue(action);
            const expanded = expandedId === action.id;

            return (
              <div key={action.id}>
                <button
                  onClick={() => {
                    setExpandedId(expanded ? null : action.id);
                    setEditStatus(action.status);
                  }}
                  className={`w-full text-left p-4 bg-white dark:bg-gray-800 rounded-xl border transition-colors ${
                    overdue
                      ? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10'
                      : 'border-gray-200 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold ${catInfo.color}`}>
                          {catInfo.label}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${PRIORITIES[action.priority] || PRIORITIES.medium}`}>
                          {action.priority}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${STATUS_BADGE[action.status] || STATUS_BADGE.open}`}>
                          {action.status.replace('_', ' ')}
                        </span>
                        {action.source && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                            {action.source}
                          </span>
                        )}
                        {overdue && (
                          <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium">
                            <AlertTriangle className="w-3 h-3" /> Overdue
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{action.title}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                        {action.assignee && (
                          <span className="flex items-center gap-1">
                            <UserIcon className="w-3 h-3" />
                            {action.assignee.firstName} {action.assignee.lastName}
                          </span>
                        )}
                        {action.dueDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(action.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform shrink-0 mt-1 ${expanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Expanded Detail */}
                {expanded && (
                  <div className="mx-2 p-4 bg-gray-50 dark:bg-gray-800/50 border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-xl -mt-1 space-y-3">
                    {action.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">{action.description}</p>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Change Status</label>
                      <div className="flex gap-2 flex-wrap">
                        {STATUSES.filter(s => s !== 'overdue').map(s => (
                          <button
                            key={s}
                            onClick={() => updateStatus(action.id, s)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize border transition-colors ${
                              action.status === s
                                ? `${STATUS_BADGE[s]} border-current`
                                : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
                            }`}
                          >
                            {s.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      Created {new Date(action.createdAt).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Action Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowCreate(false)}>
          <div
            className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">New Action</h2>
              <button onClick={() => setShowCreate(false)} aria-label="Close">
                <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
              <input
                type="text"
                value={createTitle}
                onChange={e => setCreateTitle(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="What needs to be done?"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea
                value={createDesc}
                onChange={e => setCreateDesc(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                rows={2}
                placeholder="Additional details..."
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Category (SQDCP) *</label>
              <div className="flex gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => setCreateCategory(cat.value)}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors border ${
                      createCategory === cat.value
                        ? `${cat.color} ${cat.border}`
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Priority</label>
              <div className="flex gap-2">
                {['low', 'medium', 'high', 'critical'].map(p => (
                  <button
                    key={p}
                    onClick={() => setCreatePriority(p)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors border ${
                      createPriority === p
                        ? `${PRIORITIES[p]} border-current`
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Assignee & Due Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assignee</label>
                <select
                  value={createAssignee}
                  onChange={e => setCreateAssignee(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                >
                  <option value="">-- Unassigned --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                <input
                  type="date"
                  value={createDueDate}
                  onChange={e => setCreateDueDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={createAction}
              disabled={!createTitle.trim() || submitting}
              className="w-full flex items-center justify-center gap-2 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium disabled:opacity-50 transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Action
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
