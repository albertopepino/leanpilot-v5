'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Bell, Plus, Pencil, Trash2, X, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { SkeletonList } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface EscalationRule {
  id: string;
  name: string;
  triggerType: string;
  conditionMinutes: number;
  notifyGroup: string;
  notifyLevel: string;
  tier: number;
  isActive: boolean;
  createdAt: string;
}

const TRIGGER_TYPES = [
  { value: 'breakdown', label: 'Breakdown', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { value: 'safety_incident', label: 'Safety Incident', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  { value: 'ncr_critical', label: 'NCR Critical', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  { value: 'action_overdue', label: 'Action Overdue', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
];

const NOTIFY_GROUPS = [
  'production', 'shift_management', 'maintenance', 'quality', 'safety', 'plant_management', 'engineering',
];

const NOTIFY_LEVELS = [
  { value: 'view', label: 'View' },
  { value: 'participate', label: 'Participate' },
  { value: 'manage', label: 'Manage' },
];

const TIERS = [1, 2, 3];

const EMPTY_FORM = {
  name: '',
  triggerType: 'breakdown',
  conditionMinutes: 10,
  notifyGroup: 'production',
  notifyLevel: 'view',
  tier: 1,
  isActive: true,
};

export default function EscalationPage() {
  const [rules, setRules] = useState<EscalationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<EscalationRule | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const loadRules = useCallback(async () => {
    try {
      const data = await api.get<EscalationRule[]>('/escalation');
      setRules(Array.isArray(data) ? data : []);
    } catch {
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setShowForm(true);
    setError('');
  };

  const openEdit = (rule: EscalationRule) => {
    setForm({
      name: rule.name,
      triggerType: rule.triggerType,
      conditionMinutes: rule.conditionMinutes,
      notifyGroup: rule.notifyGroup,
      notifyLevel: rule.notifyLevel,
      tier: rule.tier,
      isActive: rule.isActive,
    });
    setEditingId(rule.id);
    setShowForm(true);
    setError('');
  };

  const saveRule = async () => {
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await api.patch(`/escalation/${editingId}`, form);
        toast('success', 'Rule updated');
      } else {
        await api.post('/escalation', form);
        toast('success', 'Rule created');
      }
      setShowForm(false);
      setEditingId(null);
      await loadRules();
    } catch (e: any) {
      setError(e.message || 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/escalation/${deleteTarget.id}`);
      toast('success', 'Rule deleted');
      setDeleteTarget(null);
      await loadRules();
    } catch (e: any) {
      toast('error', e.message || 'Failed to delete rule');
    } finally {
      setDeleting(false);
    }
  };

  const toggleActive = async (rule: EscalationRule) => {
    try {
      await api.patch(`/escalation/${rule.id}`, { isActive: !rule.isActive });
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, isActive: !r.isActive } : r));
      toast('success', `Rule ${rule.isActive ? 'disabled' : 'enabled'}`);
    } catch (e: any) {
      toast('error', e.message || 'Failed to toggle rule');
    }
  };

  const getTriggerBadge = (type: string) => {
    const cfg = TRIGGER_TYPES.find(t => t.value === type);
    return cfg || { label: type, color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' };
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-amber-500" />
            Escalation Rules
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Configure automatic escalation triggers and notification rules
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Rule
        </button>
      </div>

      {/* Rules list */}
      {loading ? (
        <SkeletonList count={3} />
      ) : rules.length === 0 && !showForm ? (
        <EmptyState
          icon={Bell}
          title="No escalation rules"
          description="Create rules to automatically escalate breakdowns, safety incidents, and overdue actions."
          actionLabel="Add Rule"
          onAction={openCreate}
        />
      ) : (
        <div className="space-y-2">
          {rules.map(rule => {
            const badge = getTriggerBadge(rule.triggerType);
            return (
              <Card key={rule.id}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium text-gray-900 dark:text-white ${!rule.isActive ? 'opacity-50' : ''}`}>
                          {rule.name}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
                          {badge.label}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          Tier {rule.tier}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        After {rule.conditionMinutes} min — notify <span className="capitalize">{rule.notifyGroup.replace(/_/g, ' ')}</span> ({rule.notifyLevel})
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleActive(rule); }}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      aria-label={rule.isActive ? 'Disable rule' : 'Enable rule'}
                    >
                      {rule.isActive
                        ? <ToggleRight className="w-7 h-7 text-green-500" />
                        : <ToggleLeft className="w-7 h-7 text-gray-400" />
                      }
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(rule); }}
                      className="p-1.5 text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                      aria-label="Edit rule"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(rule); }}
                      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      aria-label="Delete rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Inline form (modal) */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingId ? 'Edit Escalation Rule' : 'Add Escalation Rule'}
              </h2>
              <button onClick={() => { setShowForm(false); setError(''); }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {error && (
                <div className="p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Breakdown L1 — Shift Lead"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Trigger Type</label>
                  <select
                    value={form.triggerType}
                    onChange={e => setForm(f => ({ ...f, triggerType: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  >
                    {TRIGGER_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Condition (minutes)</label>
                  <input
                    type="number"
                    min={1}
                    value={form.conditionMinutes}
                    onChange={e => setForm(f => ({ ...f, conditionMinutes: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notify Group</label>
                  <select
                    value={form.notifyGroup}
                    onChange={e => setForm(f => ({ ...f, notifyGroup: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none capitalize"
                  >
                    {NOTIFY_GROUPS.map(g => (
                      <option key={g} value={g}>{g.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notify Level</label>
                  <select
                    value={form.notifyLevel}
                    onChange={e => setForm(f => ({ ...f, notifyLevel: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  >
                    {NOTIFY_LEVELS.map(l => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tier</label>
                  <select
                    value={form.tier}
                    onChange={e => setForm(f => ({ ...f, tier: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  >
                    {TIERS.map(t => (
                      <option key={t} value={t}>Tier {t}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                      className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      {form.isActive
                        ? <ToggleRight className="w-8 h-8 text-green-500" />
                        : <ToggleLeft className="w-8 h-8 text-gray-400" />
                      }
                    </button>
                    <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => { setShowForm(false); setError(''); }}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveRule}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingId ? 'Save Changes' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Escalation Rule"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={deleteRule}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
