'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { Plus, Lightbulb, ChevronLeft, X, ArrowRight, Edit2, GripVertical } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';

interface KaizenIdea {
  id: string;
  title: string;
  problem: string;
  proposedSolution: string | null;
  status: string;
  expectedImpact: string;
  actualResult: string | null;
  area: string | null;
  expectedSavings: number | null;
  actualSavings: number | null;
  costToImplement: number | null;
  savingsType: string | null;
  createdAt: string;
  submittedBy: { firstName: string; lastName: string };
}

const STATUS_COLS = [
  { key: 'submitted', label: 'Submitted', color: 'border-gray-400', bg: 'bg-gray-50 dark:bg-gray-800/50' },
  { key: 'under_review', label: 'Under Review', color: 'border-blue-400', bg: 'bg-blue-50/50 dark:bg-blue-900/10' },
  { key: 'approved', label: 'Approved', color: 'border-green-400', bg: 'bg-green-50/50 dark:bg-green-900/10' },
  { key: 'in_progress', label: 'In Progress', color: 'border-yellow-400', bg: 'bg-yellow-50/50 dark:bg-yellow-900/10' },
  { key: 'completed', label: 'Completed', color: 'border-emerald-500', bg: 'bg-emerald-50/50 dark:bg-emerald-900/10' },
  { key: 'rejected', label: 'Rejected', color: 'border-red-400', bg: 'bg-red-50/50 dark:bg-red-900/10' },
];

const IMPACT_BADGE: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const NEXT_STATUS: Record<string, string[]> = {
  submitted: ['under_review', 'rejected'],
  under_review: ['submitted', 'approved', 'rejected'],
  approved: ['under_review', 'in_progress', 'rejected'],
  in_progress: ['approved', 'completed'],
  completed: ['in_progress'],
  rejected: ['submitted'],
};

type View = 'board' | 'create' | 'detail';

export default function KaizenPage() {
  const [items, setItems] = useState<KaizenIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('board');
  const [selected, setSelected] = useState<KaizenIdea | null>(null);
  const [error, setError] = useState('');

  // Create form
  const [title, setTitle] = useState('');
  const [problem, setProblem] = useState('');
  const [solution, setSolution] = useState('');
  const [impact, setImpact] = useState('medium');
  const [area, setArea] = useState('');
  const [expectedSavings, setExpectedSavings] = useState('');
  const [costToImplement, setCostToImplement] = useState('');
  const [savingsType, setSavingsType] = useState('cost');
  const [creating, setCreating] = useState(false);

  // Completion dialog — prompt for actual savings when moving to "completed"
  const [completionDialog, setCompletionDialog] = useState<{ id: string; expectedSavings: number | null } | null>(null);
  const [completionActualSavings, setCompletionActualSavings] = useState('');
  const [completionCost, setCompletionCost] = useState('');

  // Edit mode
  const [editing, setEditing] = useState(false);

  // Toast + DnD
  const { toast } = useToast();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const loadItems = useCallback(() => {
    api.get<KaizenIdea[]>('/tools/kaizen')
      .then(data => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  const createIdea = async () => {
    if (!title.trim() || !problem.trim()) return;
    setCreating(true);
    setError('');
    try {
      const idea = await api.post<KaizenIdea>('/tools/kaizen', {
        title: title.trim(),
        problem: problem.trim(),
        proposedSolution: solution.trim() || undefined,
        expectedImpact: impact,
        area: area.trim() || undefined,
        expectedSavings: expectedSavings ? Number(expectedSavings) : undefined,
        costToImplement: costToImplement ? Number(costToImplement) : undefined,
        savingsType: savingsType || undefined,
      });
      setItems(prev => [idea, ...prev]);
      setView('board');
      setTitle(''); setProblem(''); setSolution(''); setImpact('medium'); setArea('');
      setExpectedSavings(''); setCostToImplement(''); setSavingsType('cost');
      toast('success', 'Kaizen idea submitted');
    } catch (e: any) {
      setError(e.message || 'Failed to create idea');
    } finally {
      setCreating(false);
    }
  };

  const updateIdea = async () => {
    if (!selected || !title.trim() || !problem.trim()) return;
    setCreating(true);
    setError('');
    try {
      const updated = await api.patch<KaizenIdea>(`/tools/kaizen/${selected.id}`, {
        title: title.trim(),
        problem: problem.trim(),
        proposedSolution: solution.trim() || undefined,
        expectedImpact: impact,
        area: area.trim() || undefined,
      });
      setSelected(updated);
      setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
      setEditing(false);
      toast('success', 'Idea updated');
    } catch (e: any) {
      setError(e.message || 'Failed to update idea');
    } finally {
      setCreating(false);
    }
  };

  const changeStatus = async (id: string, newStatus: string, extraData?: { actualSavings?: number; costToImplement?: number }) => {
    // Intercept completion to prompt for actual savings
    if (newStatus === 'completed' && !extraData) {
      const item = items.find(i => i.id === id);
      setCompletionDialog({ id, expectedSavings: item?.expectedSavings ?? null });
      setCompletionActualSavings(item?.actualSavings?.toString() || item?.expectedSavings?.toString() || '');
      setCompletionCost(item?.costToImplement?.toString() || '');
      return;
    }

    try {
      const body: any = { status: newStatus };
      if (extraData?.actualSavings !== undefined) body.actualSavings = extraData.actualSavings;
      if (extraData?.costToImplement !== undefined) body.costToImplement = extraData.costToImplement;
      const updated = await api.patch<KaizenIdea>(`/tools/kaizen/${id}/status`, body);
      setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
      if (selected?.id === id) setSelected(updated);
      const col = STATUS_COLS.find(c => c.key === newStatus);
      toast('success', `Moved to ${col?.label || newStatus}`);
    } catch (e: any) {
      toast('error', e.message || 'Failed to update status');
    }
  };

  const confirmCompletion = () => {
    if (!completionDialog) return;
    changeStatus(completionDialog.id, 'completed', {
      actualSavings: completionActualSavings ? Number(completionActualSavings) : undefined,
      costToImplement: completionCost ? Number(completionCost) : undefined,
    });
    setCompletionDialog(null);
  };

  const openDetail = (idea: KaizenIdea) => {
    setSelected(idea);
    setEditing(false);
    setView('detail');
    const currentId = idea.id;
    api.get<KaizenIdea>(`/tools/kaizen/${currentId}`)
      .then(full => setSelected(prev => prev?.id === currentId ? full : prev))
      .catch(() => {});
  };

  const startEditing = () => {
    if (!selected) return;
    setTitle(selected.title);
    setProblem(selected.problem);
    setSolution(selected.proposedSolution || '');
    setImpact(selected.expectedImpact);
    setArea(selected.area || '');
    setEditing(true);
  };

  // ===== BOARD VIEW =====
  if (view === 'board') {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kaizen Board</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Continuous improvement: submit ideas, review, implement, verify
            </p>
          </div>
          <button
            onClick={() => { setView('create'); setTitle(''); setProblem(''); setSolution(''); setImpact('medium'); setArea(''); setError(''); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Idea
          </button>
        </div>

        {/* Savings Counter */}
        {(() => {
          const completed = items.filter(i => i.status === 'completed');
          // Realized = actualSavings if set, otherwise expectedSavings for completed items
          const realized = completed.reduce((sum, i) => sum + (i.actualSavings ?? i.expectedSavings ?? 0), 0);
          const active = items.filter(i => !['completed','rejected'].includes(i.status));
          const inPipeline = active.reduce((sum, i) => sum + (i.expectedSavings || 0), 0);
          const totalTarget = items.filter(i => i.status !== 'rejected').reduce((sum, i) => sum + (i.expectedSavings || 0), 0);
          const totalCost = items.filter(i => i.status !== 'rejected').reduce((sum, i) => sum + (i.costToImplement || 0), 0);
          if (totalTarget <= 0 && realized <= 0) return null;
          return (
            <div className="mb-4 grid grid-cols-4 gap-3">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-800 rounded-xl p-3 text-center">
                <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  &euro;{realized.toLocaleString()}
                </p>
                <p className="text-[11px] font-medium text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-wider mt-0.5">
                  Realized ({completed.length} done)
                </p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200/60 dark:border-blue-800 rounded-xl p-3 text-center">
                <p className="text-2xl font-extrabold text-blue-700 dark:text-blue-400 tabular-nums">
                  &euro;{inPipeline.toLocaleString()}
                </p>
                <p className="text-[11px] font-medium text-blue-600/70 dark:text-blue-400/70 uppercase tracking-wider mt-0.5">
                  In Pipeline ({active.length} active)
                </p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800 rounded-xl p-3 text-center">
                <p className="text-2xl font-extrabold text-amber-700 dark:text-amber-400 tabular-nums">
                  &euro;{totalCost.toLocaleString()}
                </p>
                <p className="text-[11px] font-medium text-amber-600/70 dark:text-amber-400/70 uppercase tracking-wider mt-0.5">
                  Implementation Cost
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700 rounded-xl p-3 text-center">
                <p className="text-2xl font-extrabold text-gray-700 dark:text-gray-300 tabular-nums">
                  &euro;{totalTarget.toLocaleString()}
                </p>
                <p className="text-[11px] font-medium text-gray-500/70 dark:text-gray-400/70 uppercase tracking-wider mt-0.5">
                  Total Expected
                </p>
              </div>
            </div>
          );
        })()}

        {/* Completion dialog — actual savings input */}
        {completionDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setCompletionDialog(null)}>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Complete Kaizen</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Enter verified savings and implementation cost before closing.
              </p>
              <label className="block mb-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Actual Savings (EUR)</span>
                <input type="number" min="0" step="100" value={completionActualSavings} onChange={e => setCompletionActualSavings(e.target.value)}
                  placeholder={completionDialog.expectedSavings ? `Expected: ${completionDialog.expectedSavings}` : '0'}
                  className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </label>
              <label className="block mb-4">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Cost to Implement (EUR)</span>
                <input type="number" min="0" step="100" value={completionCost} onChange={e => setCompletionCost(e.target.value)}
                  placeholder="0"
                  className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </label>
              <div className="flex gap-2">
                <button onClick={() => setCompletionDialog(null)}
                  className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Cancel
                </button>
                <button onClick={confirmCompletion}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors">
                  Mark Complete
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
            <span className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</span>
            <button onClick={() => setError('')} aria-label="Dismiss error"><X className="w-4 h-4 text-red-400" /></button>
          </div>
        )}

        {loading ? (
          <SkeletonList count={3} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title="No Kaizen suggestions yet"
            description="Submit your first improvement idea — even small changes compound into big results."
            actionLabel="New Idea"
            onAction={() => { setView('create'); setTitle(''); setProblem(''); setSolution(''); setImpact('medium'); setArea(''); setError(''); }}
          />
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STATUS_COLS.map(col => {
              const colItems = items.filter(i => i.status === col.key);
              // Check if any dragged item can be dropped here
              const draggedItem = draggedId ? items.find(i => i.id === draggedId) : null;
              const canDrop = draggedItem
                ? (NEXT_STATUS[draggedItem.status] || []).includes(col.key) && draggedItem.status !== col.key
                : false;
              const isOver = dragOverCol === col.key;

              return (
                <div
                  key={col.key}
                  className="flex-shrink-0 w-72"
                  onDragOver={e => {
                    if (!canDrop) return;
                    e.preventDefault();
                    setDragOverCol(col.key);
                  }}
                  onDragLeave={() => setDragOverCol(null)}
                  onDrop={e => {
                    e.preventDefault();
                    setDragOverCol(null);
                    if (draggedId && canDrop) {
                      changeStatus(draggedId, col.key);
                    }
                    setDraggedId(null);
                  }}
                >
                  <div className={`border-t-4 ${col.color} ${col.bg} rounded-t-lg px-3 py-2.5`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{col.label}</span>
                      <span className="text-xs text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full font-medium">
                        {colItems.length}
                      </span>
                    </div>
                  </div>
                  <div className={`space-y-2 mt-2 min-h-[100px] rounded-b-lg transition-colors ${
                    isOver && canDrop
                      ? 'bg-brand-50 dark:bg-brand-900/20 ring-2 ring-brand-300 dark:ring-brand-600 ring-dashed'
                      : draggedId && canDrop
                        ? 'bg-gray-50 dark:bg-gray-800/50'
                        : ''
                  }`}>
                    {colItems.map(item => (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={e => {
                          setDraggedId(item.id);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => { setDraggedId(null); setDragOverCol(null); }}
                        onClick={() => openDetail(item)}
                        className={`w-full text-left bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 cursor-grab hover:shadow-md hover:border-brand-300 dark:hover:border-brand-600 transition-all select-none ${
                          draggedId === item.id ? 'opacity-40 scale-95' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical className="w-4 h-4 text-gray-300 dark:text-gray-600 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1 line-clamp-2">
                              {item.title}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">
                              {item.problem}
                            </p>
                            {(item.expectedSavings != null && item.expectedSavings > 0) || (item.costToImplement != null && item.costToImplement > 0) ? (
                              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                                {item.expectedSavings != null && item.expectedSavings > 0 && (
                                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                    {item.status === 'completed' && item.actualSavings != null
                                      ? `€${item.actualSavings.toLocaleString()} saved`
                                      : `€${item.expectedSavings.toLocaleString()} est.`}
                                  </span>
                                )}
                                {item.costToImplement != null && item.costToImplement > 0 && (
                                  <span className="text-[10px] text-amber-600 dark:text-amber-400">
                                    (cost: €{item.costToImplement.toLocaleString()})
                                  </span>
                                )}
                                {item.savingsType && (
                                  <span className="text-[10px] text-gray-400 capitalize">· {item.savingsType}</span>
                                )}
                              </div>
                            ) : null}
                            <div className="flex items-center justify-between">
                              <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${IMPACT_BADGE[item.expectedImpact] || ''}`}>
                                {item.expectedImpact}
                              </span>
                              <span className="text-xs text-gray-400">
                                {item.submittedBy ? `${item.submittedBy.firstName} ${item.submittedBy.lastName?.[0] || ''}.` : '—'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
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
          { label: 'Kaizen Board', onClick: () => setView('board') },
          { label: 'New Idea' },
        ]} />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">New Kaizen Idea</h1>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-xl">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
              <span className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</span>
              <button onClick={() => setError('')} aria-label="Dismiss error"><X className="w-4 h-4 text-red-400" /></button>
            </div>
          )}
          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Title *</span>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Short description of improvement"
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500"
            />
          </label>
          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Problem / Current State *</span>
            <textarea value={problem} onChange={e => setProblem(e.target.value)} rows={3}
              placeholder="What is wrong today? What waste do you see?"
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500"
            />
          </label>
          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Proposed Solution</span>
            <textarea value={solution} onChange={e => setSolution(e.target.value)} rows={3}
              placeholder="How would you fix it?"
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500"
            />
          </label>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Expected Impact</span>
              <select value={impact} onChange={e => setImpact(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Area (optional)</span>
              <input type="text" value={area} onChange={e => setArea(e.target.value)}
                placeholder="e.g. Assembly, Shipping"
                className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-6">
              <label className="block">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Expected Savings (EUR)</span>
                <input type="number" min="0" step="100" value={expectedSavings} onChange={e => setExpectedSavings(e.target.value)}
                  placeholder="e.g. 5000"
                  className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Cost to Implement (EUR)</span>
                <input type="number" min="0" step="100" value={costToImplement} onChange={e => setCostToImplement(e.target.value)}
                  placeholder="e.g. 500"
                  className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Savings Type</span>
                <select value={savingsType} onChange={e => setSavingsType(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                  <option value="cost">Cost Reduction</option>
                  <option value="time">Time Saving</option>
                  <option value="quality">Quality Improvement</option>
                  <option value="safety">Safety Improvement</option>
                  <option value="productivity">Productivity Gain</option>
                </select>
              </label>
            </div>
          <button onClick={createIdea} disabled={creating || !title.trim() || !problem.trim()}
            className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {creating ? 'Submitting...' : 'Submit Idea'}
          </button>
        </div>
      </div>
    );
  }

  // ===== DETAIL VIEW =====
  if (view === 'detail' && selected) {
    const nextStatuses = NEXT_STATUS[selected.status] || [];
    const statusCol = STATUS_COLS.find(c => c.key === selected.status);

    if (editing) {
      return (
        <div>
          <Breadcrumb items={[
            { label: 'Kaizen Board', onClick: () => { setView('board'); setSelected(null); setEditing(false); } },
            { label: selected.title, onClick: () => setEditing(false) },
            { label: 'Edit' },
          ]} />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Edit: {selected.title}</h1>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-xl">
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
                <span className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</span>
                <button onClick={() => setError('')} aria-label="Dismiss error"><X className="w-4 h-4 text-red-400" /></button>
              </div>
            )}
            <label className="block mb-4">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Title *</span>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </label>
            <label className="block mb-4">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Problem *</span>
              <textarea value={problem} onChange={e => setProblem(e.target.value)} rows={3}
                className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </label>
            <label className="block mb-4">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Proposed Solution</span>
              <textarea value={solution} onChange={e => setSolution(e.target.value)} rows={3}
                className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </label>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <label className="block">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Impact</span>
                <select value={impact} onChange={e => setImpact(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Area</span>
                <input type="text" value={area} onChange={e => setArea(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </label>
            </div>
            <button onClick={updateIdea} disabled={creating || !title.trim() || !problem.trim()}
              className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium"
            >
              {creating ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div>
        <Breadcrumb items={[
          { label: 'Kaizen Board', onClick: () => { setView('board'); setSelected(null); } },
          { label: selected.title },
        ]} />

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{selected.title}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              {selected.submittedBy?.firstName} {selected.submittedBy?.lastName} — {new Date(selected.createdAt).toLocaleDateString()}
              {selected.area && <> — <span className="text-gray-600 dark:text-gray-300">{selected.area}</span></>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium border-t-2 ${statusCol?.color || ''} ${statusCol?.bg || ''} text-gray-700 dark:text-gray-300`}>
              {statusCol?.label || selected.status}
            </span>
            <button onClick={startEditing} className="p-2 text-gray-400 hover:text-brand-600 transition-colors" aria-label="Edit idea">
              <Edit2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Problem</h3>
              <p className="text-gray-800 dark:text-gray-200 text-sm whitespace-pre-wrap">{selected.problem}</p>
            </div>
            {selected.proposedSolution && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Proposed Solution</h3>
                <p className="text-gray-800 dark:text-gray-200 text-sm whitespace-pre-wrap">{selected.proposedSolution}</p>
              </div>
            )}
            {selected.actualResult && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Actual Result</h3>
                <p className="text-gray-800 dark:text-gray-200 text-sm whitespace-pre-wrap">{selected.actualResult}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Impact</h3>
              <span className={`px-3 py-1 rounded-full text-sm capitalize ${IMPACT_BADGE[selected.expectedImpact] || ''}`}>
                {selected.expectedImpact}
              </span>
            </div>

            {nextStatuses.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Move To</h3>
                <div className="flex flex-wrap gap-2">
                  {nextStatuses.map(ns => {
                    const col = STATUS_COLS.find(c => c.key === ns);
                    return (
                      <button
                        key={ns}
                        onClick={() => changeStatus(selected.id, ns)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-all hover:shadow-sm ${
                          ns === 'rejected'
                            ? 'border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        {col?.label || ns}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  setView('board');
  setSelected(null);
  return null;
}
