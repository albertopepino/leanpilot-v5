'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Plus, Pencil, Trash2, X, Check, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { SkeletonList } from '@/components/ui/Skeleton';

const CATEGORIES = ['breakdown', 'changeover', 'quality', 'idle', 'maintenance', 'planned_stop', 'scrap'] as const;

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  breakdown: { label: 'Breakdown', color: '#ef4444' },
  changeover: { label: 'Changeover', color: '#eab308' },
  quality: { label: 'Quality Hold', color: '#a855f7' },
  idle: { label: 'Idle / Minor Stop', color: '#6b7280' },
  maintenance: { label: 'Maintenance', color: '#3b82f6' },
  planned_stop: { label: 'Planned Stop', color: '#f97316' },
  scrap: { label: 'Scrap / Defect', color: '#dc2626' },
};

const PRESET_COLORS = [
  { value: '#ef4444', label: 'Red' },
  { value: '#f97316', label: 'Orange' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#22c55e', label: 'Green' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#a855f7', label: 'Purple' },
  { value: '#6b7280', label: 'Gray' },
];

const WS_TYPES = [
  { value: 'machine', label: 'Machine' },
  { value: 'line', label: 'Line' },
  { value: 'manual', label: 'Manual' },
];

type ReasonCode = {
  id: string;
  siteId: string;
  category: string;
  code: string;
  label: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  workstationTypes: string | null;
};

export default function ReasonCodesPage() {
  const [codes, setCodes] = useState<ReasonCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingCategory, setAddingCategory] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Add form state
  const [addForm, setAddForm] = useState({ code: '', label: '', color: '#6b7280', wsTypes: [] as string[] });
  // Edit form state
  const [editForm, setEditForm] = useState({ label: '', color: '' });

  const loadCodes = async () => {
    try {
      const res = await api.get<any>('/shopfloor/reason-codes/all');
      setCodes(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error(err);
      toast('error', 'Failed to load reason codes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCodes(); }, []);

  const groupedByCategory = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = codes.filter(c => c.category === cat);
    return acc;
  }, {} as Record<string, ReasonCode[]>);

  const handleAdd = async (category: string) => {
    if (!addForm.code.trim() || !addForm.label.trim()) {
      toast('error', 'Code and label are required');
      return;
    }
    setSaving(true);
    try {
      const maxSort = Math.max(0, ...groupedByCategory[category].map(c => c.sortOrder));
      await api.post('/shopfloor/reason-codes', {
        category,
        code: addForm.code.toUpperCase().trim(),
        label: addForm.label.trim(),
        color: addForm.color,
        workstationTypes: addForm.wsTypes.length > 0 ? JSON.stringify(addForm.wsTypes) : null,
        sortOrder: maxSort + 1,
      });
      toast('success', 'Reason code created');
      setAddingCategory(null);
      setAddForm({ code: '', label: '', color: '#6b7280', wsTypes: [] });
      loadCodes();
    } catch (err: any) {
      toast('error', err?.message || 'Failed to create reason code');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    setSaving(true);
    try {
      await api.patch(`/shopfloor/reason-codes/${id}`, {
        label: editForm.label.trim(),
        color: editForm.color,
      });
      toast('success', 'Reason code updated');
      setEditingId(null);
      loadCodes();
    } catch (err: any) {
      toast('error', err?.message || 'Failed to update reason code');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (rc: ReasonCode) => {
    try {
      await api.patch(`/shopfloor/reason-codes/${rc.id}`, {
        isActive: !rc.isActive,
      });
      toast('success', `Reason code ${rc.isActive ? 'disabled' : 'enabled'}`);
      loadCodes();
    } catch (err: any) {
      toast('error', err?.message || 'Failed to toggle reason code');
    }
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    try {
      await api.delete(`/shopfloor/reason-codes/${id}`);
      toast('success', 'Reason code deleted');
      setDeleteConfirmId(null);
      loadCodes();
    } catch (err: any) {
      toast('error', err?.message || 'Failed to delete reason code');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (rc: ReasonCode) => {
    setEditingId(rc.id);
    setEditForm({ label: rc.label, color: rc.color });
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reason Codes</h1>
        <SkeletonList count={5} />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reason Codes</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Stop and change reasons that operators pick on the shop floor.
        </p>
      </div>

      {/* Category sections */}
      <div className="space-y-4">
        {CATEGORIES.map(category => {
          const meta = CATEGORY_LABELS[category];
          const items = groupedByCategory[category];

          return (
            <div
              key={category}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              {/* Category header */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: meta.color }}
                />
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  {meta.label}
                </h2>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {items.length} code{items.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Reason code list */}
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {items.length === 0 && addingCategory !== category && (
                  <div className="px-5 py-4 text-sm text-gray-400 dark:text-gray-500 italic">
                    No reason codes in this category yet.
                  </div>
                )}

                {items.map(rc => (
                  <div
                    key={rc.id}
                    className={`flex items-center gap-3 px-5 py-3 group ${
                      !rc.isActive ? 'opacity-50' : ''
                    }`}
                  >
                    {editingId === rc.id ? (
                      /* Inline edit mode */
                      <>
                        <code className="text-xs font-mono font-bold text-gray-500 dark:text-gray-400 w-14 flex-shrink-0">
                          {rc.code}
                        </code>
                        <input
                          type="text"
                          value={editForm.label}
                          onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}
                          className="flex-1 text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleUpdate(rc.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                        <div className="flex items-center gap-1">
                          {PRESET_COLORS.map(pc => (
                            <button
                              key={pc.value}
                              onClick={() => setEditForm(f => ({ ...f, color: pc.value }))}
                              className={`w-5 h-5 rounded-full border-2 transition-all ${
                                editForm.color === pc.value
                                  ? 'border-gray-900 dark:border-white scale-110'
                                  : 'border-transparent hover:border-gray-300'
                              }`}
                              style={{ backgroundColor: pc.value }}
                              title={pc.label}
                            />
                          ))}
                        </div>
                        <button
                          onClick={() => handleUpdate(rc.id)}
                          disabled={saving}
                          className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      /* Display mode */
                      <>
                        <code className="text-xs font-mono font-bold text-gray-500 dark:text-gray-400 w-14 flex-shrink-0">
                          {rc.code}
                        </code>
                        <span className="flex-1 text-sm text-gray-900 dark:text-white">
                          {rc.label}
                          {rc.workstationTypes && (() => {
                            try {
                              const types = JSON.parse(rc.workstationTypes) as string[];
                              return types.length > 0 ? (
                                <span className="ml-2 text-xs text-gray-400">({types.join(', ')})</span>
                              ) : null;
                            } catch { return null; }
                          })()}
                        </span>
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: rc.color }}
                          title={rc.color}
                        />
                        {/* Active/inactive toggle */}
                        <button
                          onClick={() => handleToggleActive(rc)}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                          title={rc.isActive ? 'Disable' : 'Enable'}
                        >
                          {rc.isActive ? (
                            <ToggleRight className="w-5 h-5 text-green-500" />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                        {/* Edit */}
                        <button
                          onClick={() => startEdit(rc)}
                          className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {/* Delete */}
                        {deleteConfirmId === rc.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(rc.id)}
                              disabled={saving}
                              className="px-2 py-0.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
                            >
                              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Delete'}
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2 py-0.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(rc.id)}
                            className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ))}

                {/* Inline add form */}
                {addingCategory === category && (
                  <div className="flex items-center gap-3 px-5 py-3 bg-blue-50/50 dark:bg-blue-900/10">
                    <input
                      type="text"
                      placeholder="CODE"
                      value={addForm.code}
                      onChange={e => setAddForm(f => ({ ...f, code: e.target.value.toUpperCase().slice(0, 6) }))}
                      className="w-16 text-xs font-mono font-bold px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white uppercase focus:ring-2 focus:ring-blue-500 outline-none"
                      autoFocus
                    />
                    <input
                      type="text"
                      placeholder="Label (e.g. Mechanical failure)"
                      value={addForm.label}
                      onChange={e => setAddForm(f => ({ ...f, label: e.target.value }))}
                      className="flex-1 text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleAdd(category);
                        if (e.key === 'Escape') {
                          setAddingCategory(null);
                          setAddForm({ code: '', label: '', color: '#6b7280', wsTypes: [] });
                        }
                      }}
                    />
                    <div className="flex items-center gap-1">
                      {PRESET_COLORS.map(pc => (
                        <button
                          key={pc.value}
                          onClick={() => setAddForm(f => ({ ...f, color: pc.value }))}
                          className={`w-5 h-5 rounded-full border-2 transition-all ${
                            addForm.color === pc.value
                              ? 'border-gray-900 dark:border-white scale-110'
                              : 'border-transparent hover:border-gray-300'
                          }`}
                          style={{ backgroundColor: pc.value }}
                          title={pc.label}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>Applies to:</span>
                      {WS_TYPES.map(wt => (
                        <label key={wt.value} className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={addForm.wsTypes.includes(wt.value)}
                            onChange={e => {
                              setAddForm(f => ({
                                ...f,
                                wsTypes: e.target.checked
                                  ? [...f.wsTypes, wt.value]
                                  : f.wsTypes.filter(t => t !== wt.value),
                              }));
                            }}
                            className="rounded text-brand-600"
                          />
                          {wt.label}
                        </label>
                      ))}
                      <span className="text-gray-400">(none = all)</span>
                    </div>
                    <button
                      onClick={() => handleAdd(category)}
                      disabled={saving}
                      className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => {
                        setAddingCategory(null);
                        setAddForm({ code: '', label: '', color: '#6b7280', wsTypes: [] });
                      }}
                      className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Add button */}
              {addingCategory !== category && (
                <button
                  onClick={() => {
                    setAddingCategory(category);
                    setAddForm({ code: '', label: '', color: meta.color, wsTypes: [] });
                    setEditingId(null);
                  }}
                  className="w-full flex items-center gap-2 px-5 py-2.5 text-xs font-medium text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors border-t border-gray-100 dark:border-gray-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add reason code
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
