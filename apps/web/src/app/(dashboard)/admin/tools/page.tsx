'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Settings, Loader2, Save } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Breadcrumb } from '@/components/ui/Breadcrumb';

interface ToolConfig {
  toolSlug: string;
  label: string;
  isEnabled: boolean;
  minRole: string;
  alwaysEnabled: boolean;
}

const FEATURE_GROUPS: Record<string, { label: string; slugs: string[] }> = {
  core: {
    label: 'Core',
    slugs: ['dashboard'],
  },
  production: {
    label: 'Production',
    slugs: ['shift-handover', 'orders'],
  },
  continuous_improvement: {
    label: 'Continuous Improvement',
    slugs: ['gemba', 'five-s', 'kaizen'],
  },
  quality: {
    label: 'Quality',
    slugs: ['quality'],
  },
  safety: {
    label: 'Safety',
    slugs: ['safety'],
  },
  maintenance: {
    label: 'Maintenance',
    slugs: ['equipment'],
  },
  problem_solving: {
    label: 'Problem Solving',
    slugs: ['smed'],
  },
  shift_mgmt: {
    label: 'Shift Management',
    slugs: ['tier-meetings'],
  },
  people: {
    label: 'People',
    slugs: ['skills', 'actions'],
  },
};

const ROLE_OPTIONS = [
  { value: 'viewer', label: 'Viewer' },
  { value: 'operator', label: 'Operator' },
  { value: 'manager', label: 'Manager' },
  { value: 'site_admin', label: 'Site Admin' },
  { value: 'corporate_admin', label: 'Corporate Admin' },
];

export default function ToolsConfigPage() {
  const [tools, setTools] = useState<ToolConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      const data = await api.get<any>('/site-config/tools');
      setTools(Array.isArray(data) ? data : []);
    } catch {
      toast('error', 'Failed to load tool configuration');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const toggle = (slug: string) => {
    setTools(prev =>
      prev.map(t =>
        t.toolSlug === slug && !t.alwaysEnabled
          ? { ...t, isEnabled: !t.isEnabled }
          : t,
      ),
    );
    setDirty(true);
  };

  const changeMinRole = (slug: string, role: string) => {
    setTools(prev =>
      prev.map(t =>
        t.toolSlug === slug ? { ...t, minRole: role } : t,
      ),
    );
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = tools.map(t => ({
        toolSlug: t.toolSlug,
        isEnabled: t.isEnabled,
        minRole: t.minRole,
      }));
      const updated = await api.patch<ToolConfig[]>('/site-config/tools', { tools: payload });
      setTools(Array.isArray(updated) ? updated : tools);
      setDirty(false);
      toast('success', 'Tool configuration saved');
    } catch (e: any) {
      toast('error', e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Group tools by feature group
  const grouped = Object.entries(FEATURE_GROUPS)
    .map(([key, group]) => ({
      key,
      label: group.label,
      tools: group.slugs
        .map(slug => tools.find(t => t.toolSlug === slug))
        .filter(Boolean) as ToolConfig[],
    }))
    .filter(g => g.tools.length > 0);

  // Any tools not in a group
  const groupedSlugs = new Set(Object.values(FEATURE_GROUPS).flatMap(g => g.slugs));
  const ungrouped = tools.filter(t => !groupedSlugs.has(t.toolSlug));

  if (loading) {
    return (
      <div className="px-6 py-8">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto">
      <Breadcrumb items={[{ label: 'Admin' }, { label: 'Tool Configuration' }]} />

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-500 to-gray-400
                          flex items-center justify-center shadow-md">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Tool Configuration</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enable or disable lean tools for this site
            </p>
          </div>
        </div>
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700
                     text-white rounded-lg text-sm font-medium transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      <div className="space-y-8">
        {grouped.map(group => (
          <div key={group.key}>
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3 px-1">
              {group.label}
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
              {group.tools.map(tool => (
                <div
                  key={tool.toolSlug}
                  className="flex items-center justify-between px-5 py-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Toggle */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={tool.isEnabled}
                      disabled={tool.alwaysEnabled}
                      onClick={() => toggle(tool.toolSlug)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
                        tool.isEnabled
                          ? 'bg-brand-600'
                          : 'bg-gray-200 dark:bg-gray-600'
                      } ${tool.alwaysEnabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          tool.isEnabled ? 'translate-x-5' : 'translate-x-0.5'
                        } mt-0.5`}
                      />
                    </button>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium ${
                        tool.isEnabled
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-400 dark:text-gray-500'
                      }`}>
                        {tool.label}
                        {tool.alwaysEnabled && (
                          <span className="ml-2 text-xs text-gray-400 dark:text-gray-500 font-normal">(always on)</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">Min role:</span>
                    <select
                      value={tool.minRole}
                      onChange={(e) => changeMinRole(tool.toolSlug, e.target.value)}
                      className="text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600
                                 rounded-md px-2 py-1.5 text-gray-700 dark:text-gray-300
                                 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    >
                      {ROLE_OPTIONS.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {ungrouped.length > 0 && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3 px-1">
              Other
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
              {ungrouped.map(tool => (
                <div
                  key={tool.toolSlug}
                  className="flex items-center justify-between px-5 py-4"
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={tool.isEnabled}
                      disabled={tool.alwaysEnabled}
                      onClick={() => toggle(tool.toolSlug)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
                        tool.isEnabled
                          ? 'bg-brand-600'
                          : 'bg-gray-200 dark:bg-gray-600'
                      } ${tool.alwaysEnabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          tool.isEnabled ? 'translate-x-5' : 'translate-x-0.5'
                        } mt-0.5`}
                      />
                    </button>
                    <p className={`text-sm font-medium ${
                      tool.isEnabled
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {tool.label}
                    </p>
                  </div>
                  <select
                    value={tool.minRole}
                    onChange={(e) => changeMinRole(tool.toolSlug, e.target.value)}
                    className="text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600
                               rounded-md px-2 py-1.5 text-gray-700 dark:text-gray-300
                               focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    {ROLE_OPTIONS.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
