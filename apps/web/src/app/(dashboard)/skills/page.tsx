'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  GraduationCap, Plus, X, Loader2, AlertTriangle, Filter,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';

// ── Types ──────────────────────────────────────────────────────────────

interface Skill {
  id: string;
  name: string;
  category: string;
  description?: string;
}

interface SkillMatrixEntry {
  userId: string;
  userName: string;
  skills: Record<string, number>; // skillId -> level (0-4)
}

interface SkillGap {
  id: string;
  name: string;
  category: string;
  maxLevel: number;
}

// ── Constants ──────────────────────────────────────────────────────────

const SKILL_LEVELS = [
  { level: 0, label: 'None', display: '', cellClass: 'bg-gray-50 dark:bg-gray-800' },
  { level: 1, label: 'Learning', display: '\u{1F535}', cellClass: 'bg-blue-50 dark:bg-blue-900/20' },
  { level: 2, label: 'Competent', display: '\u{1F7E2}', cellClass: 'bg-green-50 dark:bg-green-900/20' },
  { level: 3, label: 'Proficient', display: '\u2B50', cellClass: 'bg-yellow-50 dark:bg-yellow-900/20' },
  { level: 4, label: 'Trainer', display: '\u{1F468}\u200D\u{1F3EB}', cellClass: 'bg-purple-50 dark:bg-purple-900/20' },
] as const;

const CATEGORIES = ['technical', 'safety', 'quality', 'leadership', 'process'] as const;

const CATEGORY_BADGE: Record<string, string> = {
  technical: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  safety: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  quality: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  leadership: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  process: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

type TabView = 'matrix' | 'gaps';

// ── Page ───────────────────────────────────────────────────────────────

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [matrix, setMatrix] = useState<SkillMatrixEntry[]>([]);
  const [gaps, setGaps] = useState<SkillGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<TabView>('matrix');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const { toast } = useToast();

  // Create skill form
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createCategory, setCreateCategory] = useState<string>('technical');
  const [createDesc, setCreateDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Level selector
  const [activeCellUser, setActiveCellUser] = useState<string | null>(null);
  const [activeCellSkill, setActiveCellSkill] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [skillsData, matrixData] = await Promise.all([
        api.get<any>('/skills'),
        api.get<any>('/skills/matrix'),
      ]);
      setSkills(Array.isArray(skillsData) ? skillsData : skillsData?.data || []);
      setMatrix(Array.isArray(matrixData) ? matrixData : matrixData?.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGaps = useCallback(async () => {
    try {
      const res = await api.get<any>('/skills/gaps');
      setGaps(Array.isArray(res) ? res : res?.data || []);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    loadData();
    loadGaps();
  }, [loadData, loadGaps]);

  const createSkill = async () => {
    if (!createName.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/skills', {
        name: createName.trim(),
        category: createCategory,
        description: createDesc.trim() || undefined,
      });
      setCreateName('');
      setCreateDesc('');
      setCreateCategory('technical');
      setShowCreate(false);
      toast('success', 'Skill created');
      await loadData();
      await loadGaps();
    } catch (e: any) {
      toast('error', e.message || 'Failed to create skill');
    } finally {
      setSubmitting(false);
    }
  };

  const setLevel = async (userId: string, skillId: string, level: number) => {
    try {
      await api.patch(`/skills/user/${userId}/skill/${skillId}`, { level });
      // Update matrix locally
      setMatrix(prev => prev.map(entry => {
        if (entry.userId === userId) {
          return { ...entry, skills: { ...entry.skills, [skillId]: level } };
        }
        return entry;
      }));
      setActiveCellUser(null);
      setActiveCellSkill(null);
      await loadGaps();
    } catch (e: any) {
      toast('error', e.message || 'Failed to update level');
    }
  };

  const filteredSkills = filterCategory
    ? skills.filter(s => s.category === filterCategory)
    : skills;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-brand-600" />
            Skills Matrix
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Visual competency map — identify gaps and training needs
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium text-sm"
        >
          <Plus className="w-4 h-4" /> Add Skill
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between">
          <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
          <button onClick={() => setError('')} aria-label="Dismiss error"><X className="w-4 h-4 text-red-400" /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('matrix')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'matrix'
              ? 'bg-brand-600 text-white'
              : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
          }`}
        >
          Matrix View
        </button>
        <button
          onClick={() => setTab('gaps')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
            tab === 'gaps'
              ? 'bg-brand-600 text-white'
              : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Skill Gaps
          {gaps.length > 0 && (
            <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
              tab === 'gaps' ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {gaps.length}
            </span>
          )}
        </button>
      </div>

      {/* Category Filter */}
      {tab === 'matrix' && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Filter className="w-4 h-4 text-gray-400" />
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
              key={cat}
              onClick={() => setFilterCategory(filterCategory === cat ? '' : cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize transition-colors ${
                filterCategory === cat ? `${CATEGORY_BADGE[cat]} border-current` : 'border-gray-200 dark:border-gray-700 text-gray-500'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Legend */}
      {tab === 'matrix' && (
        <div className="flex items-center gap-4 mb-4 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
          {SKILL_LEVELS.map(sl => (
            <span key={sl.level} className="flex items-center gap-1">
              {sl.display || <span className="w-4 h-4 rounded bg-gray-200 dark:bg-gray-700 inline-block" />}
              <span>{sl.label} ({sl.level})</span>
            </span>
          ))}
        </div>
      )}

      {loading && <SkeletonList count={4} />}

      {/* Matrix View */}
      {tab === 'matrix' && !loading && (
        <>
          {filteredSkills.length === 0 || matrix.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="No skills data yet"
              description="Add skills and assign competency levels to team members."
              actionLabel="Add Skill"
              onAction={() => setShowCreate(true)}
            />
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[150px]">
                      Operator
                    </th>
                    {filteredSkills.map(skill => (
                      <th key={skill.id} className="px-2 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 min-w-[80px]">
                        <div className="truncate max-w-[80px]" title={skill.name}>{skill.name}</div>
                        <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium ${CATEGORY_BADGE[skill.category] || CATEGORY_BADGE.technical}`}>
                          {skill.category}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map(entry => (
                    <tr key={entry.userId} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-700/20">
                      <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                        {entry.userName}
                      </td>
                      {filteredSkills.map(skill => {
                        const level = entry.skills[skill.id] ?? 0;
                        const levelInfo = SKILL_LEVELS[level] || SKILL_LEVELS[0];
                        const isActive = activeCellUser === entry.userId && activeCellSkill === skill.id;

                        return (
                          <td
                            key={skill.id}
                            className={`px-2 py-2.5 text-center relative ${levelInfo.cellClass}`}
                          >
                            {isActive ? (
                              <div className="absolute inset-0 z-20 bg-white dark:bg-gray-800 border-2 border-brand-500 rounded-lg shadow-lg flex items-center justify-center gap-1 p-1">
                                {SKILL_LEVELS.map(sl => (
                                  <button
                                    key={sl.level}
                                    onClick={() => setLevel(entry.userId, skill.id, sl.level)}
                                    className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                                      level === sl.level
                                        ? 'bg-brand-600 text-white'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                                    }`}
                                    title={sl.label}
                                  >
                                    {sl.level}
                                  </button>
                                ))}
                                <button
                                  onClick={() => { setActiveCellUser(null); setActiveCellSkill(null); }}
                                  className="w-6 h-6 rounded text-gray-400 hover:text-gray-600"
                                  aria-label="Cancel"
                                >
                                  <X className="w-3.5 h-3.5 mx-auto" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setActiveCellUser(entry.userId);
                                  setActiveCellSkill(skill.id);
                                }}
                                className="w-8 h-8 rounded-lg hover:ring-2 hover:ring-brand-500/50 transition-all flex items-center justify-center mx-auto"
                                title={`${entry.userName} - ${skill.name}: ${levelInfo.label}`}
                              >
                                <span className="text-sm">{levelInfo.display || <span className="text-gray-300 dark:text-gray-600">-</span>}</span>
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Gaps View */}
      {tab === 'gaps' && !loading && (
        <div className="space-y-2">
          {gaps.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="No skill gaps found"
              description="All skills have at least one person at proficient level (3+). Great coverage!"
            />
          ) : (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Skills where no team member has reached proficient level (3+):
              </p>
              {gaps.map(gap => (
                <div
                  key={gap.id}
                  className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{gap.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${CATEGORY_BADGE[gap.category] || CATEGORY_BADGE.technical}`}>
                        {gap.category}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Highest level: {gap.maxLevel} ({SKILL_LEVELS[gap.maxLevel]?.label || 'None'})
                      </span>
                    </div>
                  </div>
                  <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400 shrink-0" />
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Create Skill Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowCreate(false)}>
          <div
            className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">New Skill</h2>
              <button onClick={() => setShowCreate(false)} aria-label="Close">
                <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
              <input
                type="text"
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                placeholder="e.g. CNC Lathe Operation"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Category</label>
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCreateCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize border transition-colors ${
                      createCategory === cat ? `${CATEGORY_BADGE[cat]} border-current` : 'border-gray-200 dark:border-gray-700 text-gray-500'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea
                value={createDesc}
                onChange={e => setCreateDesc(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                rows={2}
                placeholder="What does this skill involve?"
              />
            </div>

            <button
              onClick={createSkill}
              disabled={!createName.trim() || submitting}
              className="w-full flex items-center justify-center gap-2 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium disabled:opacity-50 transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Skill
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
