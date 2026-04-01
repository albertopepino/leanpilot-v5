'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  Users2, Plus, X, Clock, CheckCircle2, AlertTriangle,
  ChevronRight, Loader2, ArrowUpRight, Calendar,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';

// ── Types ──────────────────────────────────────────────────────────────

interface TierMeeting {
  id: string;
  tier: number;
  date: string;
  status: 'in_progress' | 'completed';
  facilitator?: { firstName: string; lastName: string };
  items: TierMeetingItem[];
  createdAt: string;
  completedAt?: string;
}

interface TierMeetingItem {
  id: string;
  category: 'safety' | 'quality' | 'delivery' | 'cost' | 'people';
  status: 'green' | 'yellow' | 'red';
  metric?: string;
  value?: string;
  target?: string;
  comment?: string;
  escalated: boolean;
  createdAt: string;
}

// ── Constants ──────────────────────────────────────────────────────────

const TIERS = [
  { value: 1, label: 'T1 Team', desc: 'Daily stand-up at team level' },
  { value: 2, label: 'T2 Area', desc: 'Area manager review' },
  { value: 3, label: 'T3 Plant', desc: 'Plant-level management review' },
] as const;

const SQDCP = [
  { key: 'safety', label: 'Safety', shortLabel: 'S', color: 'bg-red-500', lightColor: 'bg-red-50 dark:bg-red-900/20', textColor: 'text-red-700 dark:text-red-400', borderColor: 'border-red-300 dark:border-red-700' },
  { key: 'quality', label: 'Quality', shortLabel: 'Q', color: 'bg-emerald-500', lightColor: 'bg-emerald-50 dark:bg-emerald-900/20', textColor: 'text-emerald-700 dark:text-emerald-400', borderColor: 'border-emerald-300 dark:border-emerald-700' },
  { key: 'delivery', label: 'Delivery', shortLabel: 'D', color: 'bg-blue-500', lightColor: 'bg-blue-50 dark:bg-blue-900/20', textColor: 'text-blue-700 dark:text-blue-400', borderColor: 'border-blue-300 dark:border-blue-700' },
  { key: 'cost', label: 'Cost', shortLabel: 'C', color: 'bg-amber-500', lightColor: 'bg-amber-50 dark:bg-amber-900/20', textColor: 'text-amber-700 dark:text-amber-400', borderColor: 'border-amber-300 dark:border-amber-700' },
  { key: 'people', label: 'People', shortLabel: 'P', color: 'bg-purple-500', lightColor: 'bg-purple-50 dark:bg-purple-900/20', textColor: 'text-purple-700 dark:text-purple-400', borderColor: 'border-purple-300 dark:border-purple-700' },
] as const;

const STATUS_COLORS: Record<string, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-400',
  red: 'bg-red-500',
};

type View = 'list' | 'detail';

// ── Page ───────────────────────────────────────────────────────────────

export default function TierMeetingsPage() {
  const [meetings, setMeetings] = useState<TierMeeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<TierMeeting | null>(null);
  const [view, setView] = useState<View>('list');
  const [selectedTier, setSelectedTier] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { toast } = useToast();

  // Add item form
  const [addCategory, setAddCategory] = useState<string>('');
  const [addStatus, setAddStatus] = useState<string>('green');
  const [addMetric, setAddMetric] = useState('');
  const [addValue, setAddValue] = useState('');
  const [addTarget, setAddTarget] = useState('');
  const [addComment, setAddComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<TierMeeting[]>(`/tier-meetings?tier=${selectedTier}`);
      setMeetings(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedTier]);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  const openMeeting = async (id: string) => {
    try {
      setLoading(true);
      const detail = await api.get<TierMeeting>(`/tier-meetings/${id}`);
      setSelectedMeeting(detail);
      setView('detail');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const startMeeting = async () => {
    try {
      setLoading(true);
      const meeting = await api.post<TierMeeting>('/tier-meetings', { tier: selectedTier });
      await openMeeting(meeting.id);
      toast('success', 'Meeting started');
    } catch (e: any) {
      toast('error', e.message || 'Failed to start meeting');
      setLoading(false);
    }
  };

  const completeMeeting = async () => {
    if (!selectedMeeting) return;
    try {
      await api.patch(`/tier-meetings/${selectedMeeting.id}/complete`);
      setView('list');
      setSelectedMeeting(null);
      await loadMeetings();
      toast('success', 'Meeting completed');
    } catch (e: any) {
      toast('error', e.message || 'Failed to complete meeting');
    }
  };

  const addItem = async () => {
    if (!selectedMeeting || !addCategory) return;
    setSubmitting(true);
    try {
      await api.post(`/tier-meetings/${selectedMeeting.id}/items`, {
        category: addCategory,
        status: addStatus,
        metric: addMetric.trim() || undefined,
        value: addValue.trim() || undefined,
        target: addTarget.trim() || undefined,
        comment: addComment.trim() || undefined,
      });
      setAddCategory('');
      setAddStatus('green');
      setAddMetric('');
      setAddValue('');
      setAddTarget('');
      setAddComment('');
      const detail = await api.get<TierMeeting>(`/tier-meetings/${selectedMeeting.id}`);
      setSelectedMeeting(detail);
      toast('success', 'Item added');
    } catch (e: any) {
      toast('error', e.message || 'Failed to add item');
    } finally {
      setSubmitting(false);
    }
  };

  const updateItemStatus = async (itemId: string, status: string) => {
    if (!selectedMeeting) return;
    try {
      await api.patch(`/tier-meetings/${selectedMeeting.id}/items/${itemId}`, { status });
      const detail = await api.get<TierMeeting>(`/tier-meetings/${selectedMeeting.id}`);
      setSelectedMeeting(detail);
    } catch (e: any) {
      toast('error', e.message || 'Failed to update item');
    }
  };

  const escalateItem = async (itemId: string) => {
    if (!selectedMeeting) return;
    try {
      await api.patch(`/tier-meetings/${selectedMeeting.id}/items/${itemId}`, { escalated: true });
      const detail = await api.get<TierMeeting>(`/tier-meetings/${selectedMeeting.id}`);
      setSelectedMeeting(detail);
      toast('success', 'Item escalated — action created');
    } catch (e: any) {
      toast('error', e.message || 'Failed to escalate');
    }
  };

  const getItemsByCategory = (category: string) => {
    return selectedMeeting?.items.filter(item => item.category === category) || [];
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div>
      {/* Breadcrumb */}
      {view !== 'list' && (
        <Breadcrumb items={[
          { label: 'Tier Meetings', onClick: () => { setView('list'); setSelectedMeeting(null); } },
          { label: selectedMeeting ? `${TIERS.find(t => t.value === selectedMeeting.tier)?.label} — ${selectedMeeting.date}` : 'Meeting' },
        ]} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users2 className="w-6 h-6 text-brand-600" />
            {view === 'list' ? 'Tier Meetings' : `${TIERS.find(t => t.value === selectedMeeting?.tier)?.label} Meeting`}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {view === 'list' ? 'Daily management with SQDCP boards' : selectedMeeting?.date}
          </p>
        </div>
        {view === 'list' && (
          <button
            onClick={startMeeting}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium text-sm disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Start Meeting
          </button>
        )}
        {view === 'detail' && selectedMeeting?.status === 'in_progress' && (
          <button
            onClick={completeMeeting}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
          >
            <CheckCircle2 className="w-4 h-4" /> Complete Meeting
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between">
          <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
          <button onClick={() => setError('')} aria-label="Dismiss error"><X className="w-4 h-4 text-red-400" /></button>
        </div>
      )}

      {/* Tier Selector (list view) */}
      {view === 'list' && (
        <div className="flex gap-2 mb-6">
          {TIERS.map(tier => (
            <button
              key={tier.value}
              onClick={() => setSelectedTier(tier.value)}
              className={`flex-1 p-3 rounded-xl text-sm font-medium border transition-colors ${
                selectedTier === tier.value
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300'
              }`}
            >
              <div className="font-semibold">{tier.label}</div>
              <div className="text-xs opacity-70 mt-0.5">{tier.desc}</div>
            </button>
          ))}
        </div>
      )}

      {loading && <SkeletonList count={3} />}

      {/* Meeting List */}
      {view === 'list' && !loading && (
        <div className="space-y-2">
          {meetings.length === 0 ? (
            <EmptyState
              icon={Users2}
              title="No tier meetings yet"
              description={`Start a ${TIERS.find(t => t.value === selectedTier)?.label} meeting to review SQDCP performance.`}
              actionLabel="Start Meeting"
              onAction={startMeeting}
            />
          ) : (
            meetings.map(meeting => (
              <Card key={meeting.id} onClick={() => openMeeting(meeting.id)} padding="sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      meeting.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
                    }`}>
                      {meeting.status === 'completed'
                        ? <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                        : <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      }
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {TIERS.find(t => t.value === meeting.tier)?.label} — {meeting.date}
                      </div>
                      <div className="text-sm text-gray-500">
                        {meeting.items.length} item{meeting.items.length !== 1 ? 's' : ''}
                        {meeting.facilitator && ` · ${meeting.facilitator.firstName} ${meeting.facilitator.lastName}`}
                      </div>
                      {/* SQDCP status dots */}
                      <div className="flex items-center gap-1.5 mt-1">
                        {SQDCP.map(cat => {
                          const items = meeting.items.filter(i => i.category === cat.key);
                          const worstStatus = items.reduce((worst, item) => {
                            if (item.status === 'red') return 'red';
                            if (item.status === 'yellow' && worst !== 'red') return 'yellow';
                            return worst;
                          }, 'green' as string);
                          return (
                            <div key={cat.key} className="flex items-center gap-0.5">
                              <span className="text-[10px] font-bold text-gray-400">{cat.shortLabel}</span>
                              <div className={`w-3 h-3 rounded-full ${items.length > 0 ? STATUS_COLORS[worstStatus] : 'bg-gray-200 dark:bg-gray-600'}`} />
                            </div>
                          );
                        })}
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

      {/* Meeting Detail — SQDCP Board */}
      {view === 'detail' && selectedMeeting && !loading && (
        <div className="space-y-4">
          {/* SQDCP Columns */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {SQDCP.map(cat => {
              const items = getItemsByCategory(cat.key);
              return (
                <div key={cat.key} className={`rounded-xl border ${cat.borderColor} overflow-hidden`}>
                  {/* Column header */}
                  <div className={`${cat.lightColor} px-3 py-2 border-b ${cat.borderColor}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-md ${cat.color} flex items-center justify-center`}>
                        <span className="text-xs font-bold text-white">{cat.shortLabel}</span>
                      </div>
                      <span className={`text-sm font-semibold ${cat.textColor}`}>{cat.label}</span>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="p-2 space-y-2 bg-white dark:bg-gray-800 min-h-[120px]">
                    {items.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-4">No items</p>
                    )}
                    {items.map(item => (
                      <div key={item.id} className="p-2 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        {/* Status indicator + metric */}
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-3 h-3 rounded-full shrink-0 ${STATUS_COLORS[item.status]}`} />
                          {item.metric && (
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{item.metric}</span>
                          )}
                        </div>
                        {/* Value vs target */}
                        {(item.value || item.target) && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                            {item.value && <span className="font-semibold text-gray-700 dark:text-gray-200">{item.value}</span>}
                            {item.target && <span> / {item.target}</span>}
                          </div>
                        )}
                        {item.comment && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{item.comment}</p>
                        )}
                        {/* Actions */}
                        {selectedMeeting.status === 'in_progress' && (
                          <div className="flex items-center gap-1 mt-2">
                            {(['green', 'yellow', 'red'] as const).map(s => (
                              <button
                                key={s}
                                onClick={() => updateItemStatus(item.id, s)}
                                className={`w-5 h-5 rounded-full border-2 transition-all ${
                                  item.status === s
                                    ? `${STATUS_COLORS[s]} border-gray-600 dark:border-gray-300 scale-110`
                                    : `${STATUS_COLORS[s]} opacity-30 border-transparent hover:opacity-60`
                                }`}
                                aria-label={`Set ${s}`}
                              />
                            ))}
                            {!item.escalated && (
                              <button
                                onClick={() => escalateItem(item.id)}
                                className="ml-auto text-[10px] text-orange-600 dark:text-orange-400 font-medium flex items-center gap-0.5 hover:underline"
                              >
                                <ArrowUpRight className="w-3 h-3" /> Escalate
                              </button>
                            )}
                            {item.escalated && (
                              <span className="ml-auto text-[10px] text-orange-600 dark:text-orange-400 font-medium flex items-center gap-0.5">
                                <ArrowUpRight className="w-3 h-3" /> Escalated
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Quick add button */}
                    {selectedMeeting.status === 'in_progress' && (
                      <button
                        onClick={() => {
                          setAddCategory(cat.key);
                          setAddStatus('green');
                          setAddMetric('');
                          setAddValue('');
                          setAddTarget('');
                          setAddComment('');
                        }}
                        className="w-full p-2 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 text-xs text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Item Form (shown when category selected) */}
          {addCategory && selectedMeeting.status === 'in_progress' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Add {SQDCP.find(s => s.key === addCategory)?.label} Item
                </h3>
                <button onClick={() => setAddCategory('')} aria-label="Cancel">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Status */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
                  <div className="flex gap-2">
                    {(['green', 'yellow', 'red'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setAddStatus(s)}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize border transition-colors ${
                          addStatus === s
                            ? s === 'green' ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                              : s === 'yellow' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
                              : 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                            : 'border-gray-200 dark:border-gray-700 text-gray-500'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Metric */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">KPI / Metric</label>
                  <input
                    type="text"
                    value={addMetric}
                    onChange={e => setAddMetric(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                    placeholder="e.g. Scrap Rate"
                  />
                </div>

                {/* Value */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Value</label>
                  <input
                    type="text"
                    value={addValue}
                    onChange={e => setAddValue(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                    placeholder="e.g. 2.3%"
                  />
                </div>

                {/* Target */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Target</label>
                  <input
                    type="text"
                    value={addTarget}
                    onChange={e => setAddTarget(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                    placeholder="e.g. < 1.5%"
                  />
                </div>
              </div>

              {/* Comment */}
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Comment</label>
                <textarea
                  value={addComment}
                  onChange={e => setAddComment(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                  rows={2}
                  placeholder="Notes or context..."
                />
              </div>

              {/* Submit */}
              <button
                onClick={addItem}
                disabled={submitting}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium text-sm disabled:opacity-50 transition-colors"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add Item
              </button>
            </div>
          )}

          {/* Meeting History Link */}
          {selectedMeeting.status === 'completed' && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="text-sm text-green-700 dark:text-green-400 font-medium">
                Meeting completed{selectedMeeting.completedAt ? ` on ${new Date(selectedMeeting.completedAt).toLocaleString()}` : ''}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
