'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  Plus, Copy, Trash2, Pencil, X, Loader2, Users, Shield, ArrowLeft,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SkeletonList } from '@/components/ui/Skeleton';
import {
  FEATURE_GROUPS, FEATURE_GROUP_LABELS, PERMISSION_LEVEL_LABELS,
  type FeatureGroup, type PermissionLevel,
} from '@/lib/permissions';

const LEVELS: PermissionLevel[] = ['none', 'view', 'participate', 'manage'];

const LEVEL_COLORS: Record<PermissionLevel, string> = {
  none: 'border-gray-300 dark:border-gray-600 text-gray-400',
  view: 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/30 dark:text-blue-400',
  participate: 'border-green-400 bg-green-50 text-green-700 dark:border-green-500 dark:bg-green-900/30 dark:text-green-400',
  manage: 'border-purple-400 bg-purple-50 text-purple-700 dark:border-purple-500 dark:bg-purple-900/30 dark:text-purple-400',
};

const LEVEL_DOT_COLORS: Record<PermissionLevel, string> = {
  none: 'bg-gray-300 dark:bg-gray-600',
  view: 'bg-blue-500',
  participate: 'bg-green-500',
  manage: 'bg-purple-500',
};

const SYSTEM_ROLES = ['corporate_admin', 'site_admin', 'viewer'];

interface Role {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  isDefault: boolean;
  userCount: number;
  permissions: { featureGroup: string; level: string }[];
}

type PermissionMatrix = Record<FeatureGroup, PermissionLevel>;

function emptyMatrix(): PermissionMatrix {
  const m = {} as PermissionMatrix;
  for (const g of FEATURE_GROUPS) {
    m[g] = g === 'safety' ? 'participate' : 'none';
  }
  return m;
}

function roleToMatrix(role: Role): PermissionMatrix {
  const m = emptyMatrix();
  for (const p of role.permissions || []) {
    if (FEATURE_GROUPS.includes(p.featureGroup as FeatureGroup)) {
      m[p.featureGroup as FeatureGroup] = p.level as PermissionLevel;
    }
  }
  // Safety participate is always forced on
  if ((m.safety as string) === 'none' || (m.safety as string) === 'view') {
    m.safety = 'participate';
  }
  return m;
}

function matrixToPermissions(m: PermissionMatrix): { featureGroup: string; level: string }[] {
  return FEATURE_GROUPS.map(g => ({ featureGroup: g, level: m[g] }));
}

function permissionSummary(role: Role): string {
  const perms = role.permissions || [];
  const active = perms.filter(p => p.level !== 'none');
  if (active.length === 0) return 'No permissions';
  return active.map(p => {
    const label = FEATURE_GROUP_LABELS[p.featureGroup as FeatureGroup];
    return label ? `${label.name}: ${p.level}` : '';
  }).filter(Boolean).join(', ');
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Editor state
  const [editing, setEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [matrix, setMatrix] = useState<PermissionMatrix>(emptyMatrix());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Clone
  const [cloneName, setCloneName] = useState('');
  const [cloneId, setCloneId] = useState<string | null>(null);
  const [cloning, setCloning] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadRoles = async () => {
    try {
      const data = await api.get<Role[]>('/roles');
      setRoles(data);
    } catch (e: any) {
      toast('error', e.message || 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRoles(); }, []);

  const openCreate = () => {
    setEditId(null);
    setFormName('');
    setFormDesc('');
    setMatrix(emptyMatrix());
    setFormError('');
    setEditing(true);
  };

  const openEdit = (role: Role) => {
    if (role.isSystem) return;
    setEditId(role.id);
    setFormName(role.name);
    setFormDesc(role.description || '');
    setMatrix(roleToMatrix(role));
    setFormError('');
    setEditing(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      setFormError('Role name is required');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        name: formName.trim(),
        description: formDesc.trim() || undefined,
        permissions: matrixToPermissions(matrix),
      };
      if (editId) {
        await api.patch(`/roles/${editId}`, payload);
        toast('success', 'Role updated');
      } else {
        await api.post('/roles', payload);
        toast('success', 'Role created');
      }
      setEditing(false);
      loadRoles();
    } catch (e: any) {
      setFormError(e.message || 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  const handleClone = async () => {
    if (!cloneId || !cloneName.trim()) return;
    setCloning(true);
    try {
      await api.post(`/roles/${cloneId}/clone`, { name: cloneName.trim() });
      toast('success', 'Role cloned');
      setCloneId(null);
      setCloneName('');
      loadRoles();
    } catch (e: any) {
      toast('error', e.message || 'Failed to clone role');
    } finally {
      setCloning(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/roles/${deleteTarget.id}`);
      toast('success', 'Role deleted');
      setDeleteTarget(null);
      loadRoles();
    } catch (e: any) {
      toast('error', e.message || 'Failed to delete role');
    } finally {
      setDeleting(false);
    }
  };

  const setLevel = (group: FeatureGroup, level: PermissionLevel) => {
    // Safety participate is forced — cannot set below participate
    if (group === 'safety' && (level === 'none' || level === 'view')) return;
    setMatrix(prev => ({ ...prev, [group]: level }));
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Roles</h1>
        <SkeletonList count={4} />
      </div>
    );
  }

  // Editor view
  if (editing) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setEditing(false)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {editId ? 'Edit Role' : 'Create Role'}
          </h1>
        </div>

        {formError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
            {formError}
          </div>
        )}

        {/* Name + Description */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Role Name *
              </label>
              <input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="e.g. Operator, Team Lead"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <input
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                placeholder="Brief description of this role"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
        </div>

        {/* Permission Matrix */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Permission Matrix</h2>
            <p className="text-xs text-gray-500 mt-0.5">Set access levels for each feature group</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-48">
                    Feature Group
                  </th>
                  {LEVELS.map(level => (
                    <th key={level} className="text-center px-3 py-3 text-xs font-semibold uppercase tracking-wider w-28">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${LEVEL_DOT_COLORS[level]}`} />
                        <span className="text-gray-500">{PERMISSION_LEVEL_LABELS[level].name}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_GROUPS.map((group, i) => {
                  const info = FEATURE_GROUP_LABELS[group];
                  const isSafety = group === 'safety';
                  return (
                    <tr key={group}
                      className={`${i % 2 === 0 ? 'bg-gray-50/50 dark:bg-gray-800/50' : ''} border-b border-gray-50 dark:border-gray-800`}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900 dark:text-white text-sm">{info.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{info.description}</p>
                      </td>
                      {LEVELS.map(level => {
                        const selected = matrix[group] === level;
                        const disabled = isSafety && (level === 'none' || level === 'view');
                        return (
                          <td key={level} className="text-center px-3 py-3">
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={() => setLevel(group, level)}
                              className={`w-8 h-8 rounded-full border-2 transition-all duration-150 inline-flex items-center justify-center
                                ${disabled ? 'opacity-30 cursor-not-allowed border-gray-200 dark:border-gray-700' :
                                  selected ? LEVEL_COLORS[level] + ' ring-2 ring-offset-1 dark:ring-offset-gray-800 ring-current border-2 shadow-sm' :
                                  'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 cursor-pointer'}`}
                              aria-label={`${info.name}: ${PERMISSION_LEVEL_LABELS[level].name}`}
                            >
                              {selected && <span className={`w-3 h-3 rounded-full ${LEVEL_DOT_COLORS[level]}`} />}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 bg-amber-50/50 dark:bg-amber-900/10 border-t border-amber-200/50 dark:border-amber-800/30">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Safety &gt; Participate is always enabled for compliance. Everyone must be able to report safety incidents.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-violet-600 text-white font-medium text-sm
                       rounded-xl shadow-sm hover:shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {editId ? 'Save Changes' : 'Create Role'}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400
                       hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // List view
  const customRoles = roles.filter(r => !r.isSystem);
  const systemRoles = roles.filter(r => r.isSystem);

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Roles</h1>
          <p className="text-sm text-gray-500 mt-1">Manage custom roles and permission sets for your site</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-violet-600
                     text-white font-medium text-sm rounded-xl shadow-sm hover:shadow-md transition-all">
          <Plus className="w-4 h-4" />
          New Role
        </button>
      </div>

      {/* Custom Roles */}
      {customRoles.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center mb-8">
          <Shield className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No custom roles yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          {customRoles.map(role => (
            <div key={role.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700
                         p-5 hover:shadow-md transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{role.name}</h3>
                  {role.description && (
                    <p className="text-xs text-gray-400 mt-0.5">{role.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(role)} title="Edit"
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <Pencil className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                  <button onClick={() => { setCloneId(role.id); setCloneName(role.name + ' (Copy)'); }} title="Clone"
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <Copy className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                  {!role.isDefault && role.userCount === 0 && (
                    <button onClick={() => setDeleteTarget(role)} title="Delete"
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                    </button>
                  )}
                </div>
              </div>

              {/* Permission pills */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(role.permissions || []).filter(p => p.level !== 'none').map(p => {
                  const label = FEATURE_GROUP_LABELS[p.featureGroup as FeatureGroup];
                  if (!label) return null;
                  return (
                    <span key={p.featureGroup}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border
                        ${LEVEL_COLORS[p.level as PermissionLevel] || LEVEL_COLORS.none}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${LEVEL_DOT_COLORS[p.level as PermissionLevel] || LEVEL_DOT_COLORS.none}`} />
                      {label.name}
                    </span>
                  );
                })}
              </div>

              {/* User count */}
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Users className="w-3.5 h-3.5" />
                {role.userCount} {role.userCount === 1 ? 'user' : 'users'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* System Roles */}
      {systemRoles.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">System Roles</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {systemRoles.map(role => (
              <div key={role.id}
                className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200/50 dark:border-gray-700/50
                           p-4 opacity-70">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-gray-400" />
                  <h3 className="font-medium text-gray-600 dark:text-gray-400 text-sm">{role.name}</h3>
                </div>
                {role.description && (
                  <p className="text-xs text-gray-400 mb-2">{role.description}</p>
                )}
                <p className="text-xs text-gray-400">{role.userCount} {role.userCount === 1 ? 'user' : 'users'}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Clone dialog */}
      {cloneId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setCloneId(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-md mx-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Clone Role</h3>
              <button onClick={() => setCloneId(null)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              New role name
            </label>
            <input
              value={cloneName}
              onChange={e => setCloneName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setCloneId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400
                           hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={handleClone} disabled={cloning || !cloneName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700
                           rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                {cloning && <Loader2 className="w-4 h-4 animate-spin" />}
                Clone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Role"
        message={`Are you sure you want to delete the role "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}
