'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  Search, Plus, ChevronRight, X, ArrowRight,
  HelpCircle, GitBranch, ListOrdered, FileText,
  CheckCircle, Clock, AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';
import { GlassCard } from '@/components/ui/GlassCard';

// ===== TYPES =====
interface FiveWhyStep {
  id: string;
  stepNumber: number;
  question: string;
  answer: string;
}

interface FiveWhy {
  id: string;
  title: string;
  problemStatement: string;
  status: string;
  category: string | null;
  linkedNcrId: string | null;
  linkedIncidentId: string | null;
  steps: FiveWhyStep[];
  rootCause: string | null;
  createdBy: { firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

interface IshikawaCause {
  id: string;
  category: string;
  description: string;
  isRootCause: boolean;
}

interface Ishikawa {
  id: string;
  title: string;
  problemStatement: string;
  status: string;
  category: string | null;
  linkedNcrId: string | null;
  linkedIncidentId: string | null;
  causes: IshikawaCause[];
  createdBy: { firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

interface EightD {
  id: string;
  title: string;
  problemStatement: string;
  status: string;
  category: string | null;
  linkedNcrId: string | null;
  linkedIncidentId: string | null;
  d0_emergencyAction: string | null;
  d1_team: string | null;
  d2_problemDescription: string | null;
  d3_interimContainment: string | null;
  d4_rootCause: string | null;
  d5_correctiveAction: string | null;
  d6_implementation: string | null;
  d7_preventiveAction: string | null;
  d8_congratulations: string | null;
  createdBy: { firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

type RcaMethod = 'five-why' | 'ishikawa' | 'eight-d';

interface UnifiedRca {
  id: string;
  method: RcaMethod;
  title: string;
  problemStatement: string;
  status: string;
  category: string | null;
  linkedNcrId: string | null;
  linkedIncidentId: string | null;
  createdBy: { firstName: string; lastName: string };
  createdAt: string;
  raw: FiveWhy | Ishikawa | EightD;
}

// ===== CONSTANTS =====
const METHOD_CONFIG: Record<RcaMethod, { label: string; icon: typeof HelpCircle; color: string; bgColor: string; description: string }> = {
  'five-why': { label: '5-Why', icon: HelpCircle, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30', description: 'Drill down to root cause by asking "Why?" repeatedly' },
  'ishikawa': { label: 'Ishikawa', icon: GitBranch, color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/30', description: 'Fishbone diagram — 6M cause categories' },
  'eight-d': { label: '8D', icon: ListOrdered, color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-900/30', description: 'Structured 8-discipline problem solving' },
};

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  closed: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  in_progress: 'In Progress',
  completed: 'Completed',
  closed: 'Closed',
};

const ISHIKAWA_CATEGORIES = ['Man', 'Machine', 'Method', 'Material', 'Measurement', 'Environment'];

const EIGHT_D_STEPS = [
  { key: 'd0_emergencyAction', label: 'D0 — Emergency Response Action', placeholder: 'Describe immediate response actions taken...' },
  { key: 'd1_team', label: 'D1 — Establish the Team', placeholder: 'List team members, roles, and expertise...' },
  { key: 'd2_problemDescription', label: 'D2 — Describe the Problem', placeholder: 'Who, What, When, Where, How much...' },
  { key: 'd3_interimContainment', label: 'D3 — Interim Containment Action', placeholder: 'Temporary actions to contain the problem...' },
  { key: 'd4_rootCause', label: 'D4 — Root Cause Analysis', placeholder: 'Identify and verify root cause(s)...' },
  { key: 'd5_correctiveAction', label: 'D5 — Permanent Corrective Action', placeholder: 'Define permanent corrective actions...' },
  { key: 'd6_implementation', label: 'D6 — Implement & Validate', placeholder: 'Implementation plan and validation results...' },
  { key: 'd7_preventiveAction', label: 'D7 — Prevent Recurrence', placeholder: 'Systemic changes to prevent recurrence...' },
  { key: 'd8_congratulations', label: 'D8 — Recognize the Team', placeholder: 'Acknowledge team contributions and lessons learned...' },
];

type View = 'list' | 'detail' | 'pick-method' | 'create-five-why' | 'create-ishikawa' | 'create-eight-d';

export default function RootCausePage() {
  const [allRcas, setAllRcas] = useState<UnifiedRca[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('list');
  const [selected, setSelected] = useState<UnifiedRca | null>(null);
  const { toast } = useToast();

  // Filters
  const [search, setSearch] = useState('');
  const [filterMethod, setFilterMethod] = useState<'all' | RcaMethod>('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // 5-Why form
  const [fwTitle, setFwTitle] = useState('');
  const [fwProblem, setFwProblem] = useState('');
  const [fwCategory, setFwCategory] = useState('');
  const [fwSteps, setFwSteps] = useState<{ question: string; answer: string }[]>([{ question: 'Why?', answer: '' }]);
  const [fwSaving, setFwSaving] = useState(false);

  // Ishikawa form
  const [ishTitle, setIshTitle] = useState('');
  const [ishProblem, setIshProblem] = useState('');
  const [ishCategory, setIshCategory] = useState('');
  const [ishCauses, setIshCauses] = useState<Record<string, { description: string; isRootCause: boolean }[]>>({
    Man: [], Machine: [], Method: [], Material: [], Measurement: [], Environment: [],
  });
  const [ishNewCause, setIshNewCause] = useState<Record<string, string>>({});
  const [ishSaving, setIshSaving] = useState(false);

  // 8D form
  const [edTitle, setEdTitle] = useState('');
  const [edProblem, setEdProblem] = useState('');
  const [edCategory, setEdCategory] = useState('');
  const [edFields, setEdFields] = useState<Record<string, string>>({});
  const [edSaving, setEdSaving] = useState(false);

  // ===== DATA LOADING =====
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [fiveWhysRaw, ishikawasRaw, eightDsRaw] = await Promise.all([
        api.get<FiveWhy[]>('/rca/five-why').catch(() => []),
        api.get<Ishikawa[]>('/rca/ishikawa').catch(() => []),
        api.get<EightD[]>('/rca/eight-d').catch(() => []),
      ]);
      const fiveWhys = Array.isArray(fiveWhysRaw) ? fiveWhysRaw : fiveWhysRaw?.data || [];
      const ishikawas = Array.isArray(ishikawasRaw) ? ishikawasRaw : ishikawasRaw?.data || [];
      const eightDs = Array.isArray(eightDsRaw) ? eightDsRaw : eightDsRaw?.data || [];

      const unified: UnifiedRca[] = [
        ...(fiveWhys as any[]).map((fw: any): UnifiedRca => ({
          id: fw.id, method: 'five-why', title: fw.title, problemStatement: fw.rootCauseSummary || '',
          status: fw.status, category: fw.categoryTag || '', linkedNcrId: fw.ncrId,
          linkedIncidentId: fw.incidentId, createdBy: fw.analyst || { firstName: '?', lastName: '' }, createdAt: fw.createdAt, raw: fw,
        })),
        ...(ishikawas as any[]).map((ish: any): UnifiedRca => ({
          id: ish.id, method: 'ishikawa', title: ish.title, problemStatement: ish.rootCauseSummary || '',
          status: ish.status, category: ish.categoryTag || '', linkedNcrId: ish.ncrId,
          linkedIncidentId: ish.incidentId, createdBy: ish.analyst || { firstName: '?', lastName: '' }, createdAt: ish.createdAt, raw: ish,
        })),
        ...(eightDs as any[]).map((ed: any): UnifiedRca => ({
          id: ed.id, method: 'eight-d', title: ed.title, problemStatement: ed.d4RootCauseSummary || '',
          status: ed.status, category: ed.categoryTag || '', linkedNcrId: ed.ncrId,
          linkedIncidentId: ed.incidentId, createdBy: ed.teamLeader || { firstName: '?', lastName: '' }, createdAt: ed.createdAt, raw: ed,
        })),
      ];

      unified.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAllRcas(unified);
    } catch {
      setAllRcas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const openDetail = (rca: UnifiedRca) => {
    setSelected(rca);
    setView('detail');
  };

  // ===== CREATE ACTIONS =====
  const createFiveWhy = async () => {
    if (!fwTitle.trim() || !fwProblem.trim()) return;
    setFwSaving(true);
    try {
      const filledSteps = fwSteps.filter(s => s.answer.trim());
      // Step 1: Create the analysis
      const fw = await api.post<FiveWhy>('/rca/five-why', {
        title: fwTitle.trim(),
        categoryTag: fwCategory.trim() || undefined,
      });
      // Step 2: Add each step via separate endpoint
      for (const [i, s] of filledSteps.entries()) {
        await api.post(`/rca/five-why/${fw.id}/steps`, {
          stepNumber: i + 1,
          question: s.question,
          answer: s.answer.trim(),
        });
      }
      const unified: UnifiedRca = {
        id: fw.id, method: 'five-why', title: fw.title, problemStatement: fw.problemStatement,
        status: fw.status, category: fw.category, linkedNcrId: fw.linkedNcrId,
        linkedIncidentId: fw.linkedIncidentId, createdBy: fw.createdBy, createdAt: fw.createdAt, raw: fw,
      };
      setAllRcas(prev => [unified, ...prev]);
      setView('list');
      resetFiveWhy();
      toast('success', '5-Why analysis created');
    } catch (e: any) {
      toast('error', e.message || 'Failed to create 5-Why');
    } finally {
      setFwSaving(false);
    }
  };

  const createIshikawa = async () => {
    if (!ishTitle.trim() || !ishProblem.trim()) return;
    setIshSaving(true);
    try {
      const allCauses = Object.entries(ishCauses).flatMap(([cat, causes]) =>
        causes.map(c => ({ category: cat, description: c.description, isRootCause: c.isRootCause }))
      );
      // Step 1: Create the analysis
      const ish = await api.post<Ishikawa>('/rca/ishikawa', {
        title: ishTitle.trim(),
        categoryTag: ishCategory.trim() || undefined,
      });
      // Step 2: Add each cause via separate endpoint
      for (const cause of allCauses) {
        await api.post(`/rca/ishikawa/${ish.id}/causes`, cause);
      }
      const unified: UnifiedRca = {
        id: ish.id, method: 'ishikawa', title: ish.title, problemStatement: ish.problemStatement,
        status: ish.status, category: ish.category, linkedNcrId: ish.linkedNcrId,
        linkedIncidentId: ish.linkedIncidentId, createdBy: ish.createdBy, createdAt: ish.createdAt, raw: ish,
      };
      setAllRcas(prev => [unified, ...prev]);
      setView('list');
      resetIshikawa();
      toast('success', 'Ishikawa analysis created');
    } catch (e: any) {
      toast('error', e.message || 'Failed to create Ishikawa');
    } finally {
      setIshSaving(false);
    }
  };

  const createEightD = async () => {
    if (!edTitle.trim() || !edProblem.trim()) return;
    setEdSaving(true);
    try {
      // Step 1: Create the 8D report
      const ed = await api.post<EightD>('/rca/eight-d', {
        title: edTitle.trim(),
        categoryTag: edCategory.trim() || undefined,
      });
      // Step 2: Update with D-fields via PATCH
      const dFields = Object.fromEntries(
        Object.entries(edFields).filter(([, v]) => v && String(v).trim())
      );
      if (Object.keys(dFields).length > 0) {
        await api.patch(`/rca/eight-d/${ed.id}`, dFields);
      }
      const unified: UnifiedRca = {
        id: ed.id, method: 'eight-d', title: ed.title, problemStatement: ed.problemStatement,
        status: ed.status, category: ed.category, linkedNcrId: ed.linkedNcrId,
        linkedIncidentId: ed.linkedIncidentId, createdBy: ed.createdBy, createdAt: ed.createdAt, raw: ed,
      };
      setAllRcas(prev => [unified, ...prev]);
      setView('list');
      resetEightD();
      toast('success', '8D report created');
    } catch (e: any) {
      toast('error', e.message || 'Failed to create 8D');
    } finally {
      setEdSaving(false);
    }
  };

  const resetFiveWhy = () => { setFwTitle(''); setFwProblem(''); setFwCategory(''); setFwSteps([{ question: 'Why?', answer: '' }]); };
  const resetIshikawa = () => { setIshTitle(''); setIshProblem(''); setIshCategory(''); setIshCauses({ Man: [], Machine: [], Method: [], Material: [], Measurement: [], Environment: [] }); setIshNewCause({}); };
  const resetEightD = () => { setEdTitle(''); setEdProblem(''); setEdCategory(''); setEdFields({}); };

  // Helpers
  const addFiveWhyStep = () => {
    if (fwSteps.length >= 7) return;
    setFwSteps(prev => [...prev, { question: 'Why?', answer: '' }]);
  };

  const updateFiveWhyStep = (idx: number, answer: string) => {
    setFwSteps(prev => prev.map((s, i) => i === idx ? { ...s, answer } : s));
    if (answer.trim() && idx === fwSteps.length - 1 && fwSteps.length < 7) {
      addFiveWhyStep();
    }
  };

  const addIshikawaCause = (cat: string) => {
    const text = ishNewCause[cat]?.trim();
    if (!text) return;
    setIshCauses(prev => ({
      ...prev,
      [cat]: [...prev[cat], { description: text, isRootCause: false }],
    }));
    setIshNewCause(prev => ({ ...prev, [cat]: '' }));
  };

  const toggleRootCause = (cat: string, idx: number) => {
    setIshCauses(prev => ({
      ...prev,
      [cat]: prev[cat].map((c, i) => i === idx ? { ...c, isRootCause: !c.isRootCause } : c),
    }));
  };

  const removeIshikawaCause = (cat: string, idx: number) => {
    setIshCauses(prev => ({
      ...prev,
      [cat]: prev[cat].filter((_, i) => i !== idx),
    }));
  };

  // Filtered
  const filtered = allRcas.filter(rca => {
    if (filterMethod !== 'all' && rca.method !== filterMethod) return false;
    if (filterStatus !== 'all' && rca.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!rca.title.toLowerCase().includes(q) && !rca.problemStatement.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const goBack = () => { setView('list'); setSelected(null); };

  // ===== LIST VIEW =====
  if (view === 'list') {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Search className="w-6 h-6 text-brand-600" />
              Root Cause Analysis
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              5-Why, Ishikawa &amp; 8D — Systematic problem solving
            </p>
          </div>
          <button
            onClick={() => setView('pick-method')}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> New Analysis
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search analyses..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <select value={filterMethod} onChange={e => setFilterMethod(e.target.value as any)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white">
            <option value="all">All Methods</option>
            <option value="five-why">5-Why</option>
            <option value="ishikawa">Ishikawa</option>
            <option value="eight-d">8D</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white">
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {/* RCA list */}
        {loading ? (
          <SkeletonList count={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No analyses found"
            description="Start a root cause analysis using 5-Why, Ishikawa, or 8D methodology."
            actionLabel="New Analysis"
            onAction={() => setView('pick-method')}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map(rca => {
              const conf = METHOD_CONFIG[rca.method];
              const MethodIcon = conf.icon;
              return (
                <Card key={`${rca.method}-${rca.id}`} onClick={() => openDetail(rca)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${conf.bgColor}`}>
                        <MethodIcon className={`w-4 h-4 ${conf.color}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900 dark:text-white truncate">{rca.title}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${conf.bgColor} ${conf.color}`}>
                            {conf.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {rca.createdBy.firstName} {rca.createdBy.lastName} — {new Date(rca.createdAt).toLocaleDateString()}
                          {rca.category && <> — {rca.category}</>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(rca.linkedNcrId || rca.linkedIncidentId) && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                          Linked
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[rca.status] || STATUS_BADGE.draft}`}>
                        {STATUS_LABEL[rca.status] || rca.status}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ===== METHOD PICKER =====
  if (view === 'pick-method') {
    return (
      <div>
        <Breadcrumb items={[
          { label: 'Root Cause', onClick: goBack },
          { label: 'Choose Method' },
        ]} />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Choose Analysis Method</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Select the root cause analysis methodology best suited for your problem.</p>

        <div className="grid sm:grid-cols-3 gap-4 max-w-3xl">
          {(['five-why', 'ishikawa', 'eight-d'] as RcaMethod[]).map(method => {
            const conf = METHOD_CONFIG[method];
            const Icon = conf.icon;
            return (
              <GlassCard key={method} onClick={() => setView(`create-${method}` as View)} hover>
                <div className="text-center py-2">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 ${conf.bgColor}`}>
                    <Icon className={`w-7 h-7 ${conf.color}`} />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{conf.label}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{conf.description}</p>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>
    );
  }

  // ===== CREATE 5-WHY =====
  if (view === 'create-five-why') {
    return (
      <div>
        <Breadcrumb items={[
          { label: 'Root Cause', onClick: goBack },
          { label: 'Choose Method', onClick: () => setView('pick-method') },
          { label: '5-Why Analysis' },
        ]} />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <HelpCircle className="w-6 h-6 text-blue-500" /> 5-Why Analysis
        </h1>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-2xl">
          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Title *</span>
            <input type="text" value={fwTitle} onChange={e => setFwTitle(e.target.value)}
              placeholder="e.g. Machine stoppage on Line A"
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500" />
          </label>

          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Problem Statement *</span>
            <textarea value={fwProblem} onChange={e => setFwProblem(e.target.value)} rows={2}
              placeholder="Clearly describe the problem..."
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500" />
          </label>

          <label className="block mb-6">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Category</span>
            <input type="text" value={fwCategory} onChange={e => setFwCategory(e.target.value)}
              placeholder="e.g. Quality, Safety, Equipment"
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500" />
          </label>

          {/* Sequential Why steps */}
          <div className="space-y-3 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Ask "Why?" Sequentially</h3>
            {fwSteps.map((step, idx) => (
              <div key={idx} className={`pl-4 border-l-2 ${
                idx < fwSteps.length - 1 && step.answer.trim()
                  ? 'border-blue-400 dark:border-blue-600'
                  : 'border-gray-200 dark:border-gray-700'
              }`}>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Why #{idx + 1}</span>
                <input
                  type="text"
                  value={step.answer}
                  onChange={e => updateFiveWhyStep(idx, e.target.value)}
                  placeholder={idx === 0 ? 'Why did this problem occur?' : 'Why did the previous answer happen?'}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500"
                />
              </div>
            ))}
          </div>

          <button onClick={createFiveWhy} disabled={fwSaving || !fwTitle.trim() || !fwProblem.trim()}
            className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors">
            {fwSaving ? 'Creating...' : 'Create 5-Why Analysis'}
          </button>
        </div>
      </div>
    );
  }

  // ===== CREATE ISHIKAWA =====
  if (view === 'create-ishikawa') {
    return (
      <div>
        <Breadcrumb items={[
          { label: 'Root Cause', onClick: goBack },
          { label: 'Choose Method', onClick: () => setView('pick-method') },
          { label: 'Ishikawa / Fishbone' },
        ]} />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <GitBranch className="w-6 h-6 text-purple-500" /> Ishikawa / Fishbone
        </h1>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-3xl">
          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Title *</span>
            <input type="text" value={ishTitle} onChange={e => setIshTitle(e.target.value)}
              placeholder="e.g. Defect rate increase on Product X"
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500" />
          </label>

          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Problem Statement *</span>
            <textarea value={ishProblem} onChange={e => setIshProblem(e.target.value)} rows={2}
              placeholder="Clearly describe the effect/problem at the head of the fishbone..."
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500" />
          </label>

          <label className="block mb-6">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Category</span>
            <input type="text" value={ishCategory} onChange={e => setIshCategory(e.target.value)}
              placeholder="e.g. Quality, Process"
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500" />
          </label>

          {/* 6M Categories */}
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Cause Categories (6M)</h3>
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            {ISHIKAWA_CATEGORIES.map(cat => (
              <div key={cat} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{cat}</h4>
                {ishCauses[cat].map((cause, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-1.5">
                    <button
                      type="button"
                      onClick={() => toggleRootCause(cat, idx)}
                      className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-all ${
                        cause.isRootCause
                          ? 'border-red-500 bg-red-500'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                      title="Toggle root cause"
                    >
                      {cause.isRootCause && <CheckCircle className="w-2.5 h-2.5 text-white" />}
                    </button>
                    <span className={`text-sm flex-1 ${cause.isRootCause ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                      {cause.description}
                    </span>
                    <button onClick={() => removeIshikawaCause(cat, idx)} className="text-gray-400 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-1.5 mt-1">
                  <input
                    type="text"
                    value={ishNewCause[cat] || ''}
                    onChange={e => setIshNewCause(prev => ({ ...prev, [cat]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addIshikawaCause(cat)}
                    placeholder="Add cause..."
                    className="flex-1 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white"
                  />
                  <button onClick={() => addIshikawaCause(cat)}
                    className="px-2 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded text-xs font-medium hover:bg-purple-200 dark:hover:bg-purple-900/50">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button onClick={createIshikawa} disabled={ishSaving || !ishTitle.trim() || !ishProblem.trim()}
            className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors">
            {ishSaving ? 'Creating...' : 'Create Ishikawa Analysis'}
          </button>
        </div>
      </div>
    );
  }

  // ===== CREATE 8D =====
  if (view === 'create-eight-d') {
    return (
      <div>
        <Breadcrumb items={[
          { label: 'Root Cause', onClick: goBack },
          { label: 'Choose Method', onClick: () => setView('pick-method') },
          { label: '8D Report' },
        ]} />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <ListOrdered className="w-6 h-6 text-orange-500" /> 8D Report
        </h1>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-2xl">
          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Title *</span>
            <input type="text" value={edTitle} onChange={e => setEdTitle(e.target.value)}
              placeholder="e.g. Customer complaint — wrong part shipped"
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500" />
          </label>

          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Problem Statement *</span>
            <textarea value={edProblem} onChange={e => setEdProblem(e.target.value)} rows={2}
              placeholder="Describe the problem that triggered this 8D..."
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500" />
          </label>

          <label className="block mb-6">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Category</span>
            <input type="text" value={edCategory} onChange={e => setEdCategory(e.target.value)}
              placeholder="e.g. Customer, Internal, Supplier"
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500" />
          </label>

          {/* 8D Steps */}
          <div className="space-y-4 mb-6">
            {EIGHT_D_STEPS.map((step, idx) => (
              <div key={step.key} className={`pl-4 border-l-2 ${
                edFields[step.key]?.trim()
                  ? 'border-orange-400 dark:border-orange-600'
                  : 'border-gray-200 dark:border-gray-700'
              }`}>
                <label className="block">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{step.label}</span>
                  <textarea
                    value={edFields[step.key] || ''}
                    onChange={e => setEdFields(prev => ({ ...prev, [step.key]: e.target.value }))}
                    rows={2}
                    placeholder={step.placeholder}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500"
                  />
                </label>
              </div>
            ))}
          </div>

          <button onClick={createEightD} disabled={edSaving || !edTitle.trim() || !edProblem.trim()}
            className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors">
            {edSaving ? 'Creating...' : 'Create 8D Report'}
          </button>
        </div>
      </div>
    );
  }

  // ===== DETAIL VIEW =====
  if (view === 'detail' && selected) {
    const conf = METHOD_CONFIG[selected.method];
    const MethodIcon = conf.icon;

    return (
      <div>
        <Breadcrumb items={[
          { label: 'Root Cause', onClick: goBack },
          { label: selected.title },
        ]} />

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${conf.bgColor}`}>
                <MethodIcon className={`w-4 h-4 ${conf.color}`} />
              </div>
              {selected.title}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              {conf.label} — {selected.createdBy.firstName} {selected.createdBy.lastName} — {new Date(selected.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[selected.status] || STATUS_BADGE.draft}`}>
              {STATUS_LABEL[selected.status] || selected.status}
            </span>
            {selected.category && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                {selected.category}
              </span>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Left: Meta */}
          <div className="space-y-4">
            <Card>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Problem Statement</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {selected.problemStatement}
              </p>
            </Card>
            {(selected.linkedNcrId || selected.linkedIncidentId) && (
              <Card>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Linked Items</h3>
                {selected.linkedNcrId && <p className="text-sm text-brand-600 dark:text-brand-400">NCR: {selected.linkedNcrId}</p>}
                {selected.linkedIncidentId && <p className="text-sm text-brand-600 dark:text-brand-400">Incident: {selected.linkedIncidentId}</p>}
              </Card>
            )}
          </div>

          {/* Right: Analysis content */}
          <div className="md:col-span-2">
            {/* 5-Why detail */}
            {selected.method === 'five-why' && (() => {
              const fw = selected.raw as FiveWhy;
              return (
                <Card>
                  <h3 className="font-medium text-gray-900 dark:text-white mb-4">Why Chain</h3>
                  {(!fw.steps || fw.steps.length === 0) ? (
                    <p className="text-sm text-gray-400">No steps recorded yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {fw.steps.map((step, idx) => (
                        <div key={step.id || idx} className="pl-4 border-l-2 border-blue-400 dark:border-blue-600">
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Why #{step.stepNumber}</span>
                          <p className="text-sm text-gray-900 dark:text-white mt-1">{step.answer}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {fw.rootCause && (
                    <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <p className="text-sm font-medium text-green-700 dark:text-green-400">Root Cause: {fw.rootCause}</p>
                    </div>
                  )}
                </Card>
              );
            })()}

            {/* Ishikawa detail */}
            {selected.method === 'ishikawa' && (() => {
              const ish = selected.raw as Ishikawa;
              const groupedCauses: Record<string, IshikawaCause[]> = {};
              (ish.causes || []).forEach(c => {
                if (!groupedCauses[c.category]) groupedCauses[c.category] = [];
                groupedCauses[c.category].push(c);
              });
              return (
                <Card>
                  <h3 className="font-medium text-gray-900 dark:text-white mb-4">Fishbone Causes</h3>
                  {Object.keys(groupedCauses).length === 0 ? (
                    <p className="text-sm text-gray-400">No causes recorded yet.</p>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-4">
                      {ISHIKAWA_CATEGORIES.map(cat => {
                        const causes = groupedCauses[cat] || [];
                        if (causes.length === 0) return null;
                        return (
                          <div key={cat} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{cat}</h4>
                            <ul className="space-y-1">
                              {causes.map((c, i) => (
                                <li key={c.id || i} className={`text-sm flex items-center gap-1.5 ${c.isRootCause ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                                  {c.isRootCause && <AlertTriangle className="w-3 h-3 shrink-0" />}
                                  {c.description}
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })()}

            {/* 8D detail */}
            {selected.method === 'eight-d' && (() => {
              const ed = selected.raw as EightD;
              return (
                <div className="space-y-3">
                  {EIGHT_D_STEPS.map(step => {
                    const value = (ed as any)[step.key];
                    if (!value) return null;
                    return (
                      <Card key={step.key}>
                        <h4 className="text-sm font-semibold text-orange-600 dark:text-orange-400 mb-2">{step.label}</h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{value}</p>
                      </Card>
                    );
                  })}
                  {EIGHT_D_STEPS.every(step => !(ed as any)[step.key]) && (
                    <Card>
                      <p className="text-sm text-gray-400">No 8D steps have been filled in yet.</p>
                    </Card>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
