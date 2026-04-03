'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import {
  Wrench, Plus, ChevronRight, Search, X, ArrowLeft,
  CheckCircle, Clock, AlertTriangle, Activity, Settings2,
  Droplets, Eye as EyeIcon, Shield, Gauge,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientStatCard } from '@/components/ui/GradientStatCard';

// ===== TYPES =====
interface Workstation {
  id: string;
  name: string;
  code: string;
  type: string;
  area: string;
  criticality: 'A' | 'B' | 'C';
  equipmentStatus: 'operational' | 'degraded' | 'down';
  overdueCount?: number;
  parentId: string | null;
  children?: Workstation[];
  createdAt: string;
  updatedAt: string;
}

interface MaintenancePlan {
  id: string;
  workstationId: string;
  name: string;
  type: string;
  frequencyDays: number;
  frequencyHours: number | null;
  estimatedMinutes: number | null;
  instructions: string | null;
  nextDueDate: string;
  assignedTo: { firstName: string; lastName: string } | null;
  workstation: { id: string; name: string };
  createdAt: string;
}

interface MaintenanceLog {
  id: string;
  workstationId: string;
  type: string;
  description: string;
  durationMinutes: number;
  cost: number | null;
  performedBy: { id: string; firstName: string; lastName: string };
  performedAt: string;
}

interface CiltCheck {
  id: string;
  workstationId: string;
  cleaningDone: boolean;
  inspectionDone: boolean;
  lubricationDone: boolean;
  tighteningDone: boolean;
  abnormalityFound: boolean;
  abnormalityDescription: string | null;
  operator: { firstName: string; lastName: string };
  createdAt: string;
}

interface MaintenanceMetrics {
  mtbf: number;
  mttr: number;
  availability: number;
}

interface OverduePlan {
  id: string;
  workstationId: string;
  workstationName: string;
  type: string;
  description: string;
  nextDueDate: string;
}

// ===== CONSTANTS =====
const CRITICALITY_BADGE: Record<string, string> = {
  A: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  B: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  C: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const STATUS_DOT: Record<string, string> = {
  operational: 'bg-green-500',
  degraded: 'bg-yellow-500',
  down: 'bg-red-500',
};

const STATUS_LABEL: Record<string, string> = {
  operational: 'Operational',
  degraded: 'Degraded',
  down: 'Down',
};

const PLAN_TYPE_BADGE: Record<string, string> = {
  preventive: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  predictive: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  corrective: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  autonomous: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
};

type View = 'list' | 'detail';
type DetailTab = 'plans' | 'logs' | 'cilt';

export default function EquipmentPage() {
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('list');
  const [selected, setSelected] = useState<Workstation | null>(null);
  const { toast } = useToast();

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimer = useRef<NodeJS.Timeout>(undefined);

  useEffect(() => {
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  // Detail state
  const [activeTab, setActiveTab] = useState<DetailTab>('plans');
  const [plans, setPlans] = useState<MaintenancePlan[]>([]);
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [ciltChecks, setCiltChecks] = useState<CiltCheck[]>([]);
  const [metrics, setMetrics] = useState<MaintenanceMetrics | null>(null);
  const [overdue, setOverdue] = useState<OverduePlan[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Plan form
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planType, setPlanType] = useState('preventive');
  const [planDesc, setPlanDesc] = useState('');
  const [planFreq, setPlanFreq] = useState('monthly');
  const [planDue, setPlanDue] = useState('');
  const [planSaving, setPlanSaving] = useState(false);

  // Log form
  const [showLogForm, setShowLogForm] = useState(false);
  const [logType, setLogType] = useState('preventive');
  const [logDesc, setLogDesc] = useState('');
  const [logDuration, setLogDuration] = useState('');
  const [logCost, setLogCost] = useState('');
  const [logSaving, setLogSaving] = useState(false);

  // CILT form
  const [ciltCleaning, setCiltCleaning] = useState(false);
  const [ciltInspection, setCiltInspection] = useState(false);
  const [ciltLubrication, setCiltLubrication] = useState(false);
  const [ciltTightening, setCiltTightening] = useState(false);
  const [ciltAbnormality, setCiltAbnormality] = useState(false);
  const [ciltNotes, setCiltNotes] = useState('');
  const [ciltSaving, setCiltSaving] = useState(false);

  // ===== DATA LOADING =====
  const loadWorkstations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>('/workstations');
      setWorkstations(Array.isArray(res) ? res : res?.data || []);
    } catch {
      setWorkstations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOverdue = useCallback(async () => {
    try {
      const res = await api.get<any>('/maintenance/overdue');
      setOverdue(Array.isArray(res) ? res : res?.data || []);
    } catch {
      setOverdue([]);
    }
  }, []);

  useEffect(() => { loadWorkstations(); loadOverdue(); }, [loadWorkstations, loadOverdue]);

  const loadDetailData = useCallback(async (wsId: string) => {
    setDetailLoading(true);
    try {
      const [plansData, logsData, ciltData, metricsData] = await Promise.all([
        api.get<any>(`/maintenance/plans?workstationId=${wsId}`),
        api.get<any>(`/maintenance/logs?workstationId=${wsId}`),
        api.get<any>(`/maintenance/cilt?workstationId=${wsId}`),
        api.get<MaintenanceMetrics>(`/maintenance/metrics?workstationId=${wsId}`),
      ]);
      setPlans(Array.isArray(plansData) ? plansData : []);
      setLogs(Array.isArray(logsData) ? logsData : []);
      setCiltChecks(Array.isArray(ciltData) ? ciltData : []);
      setMetrics(metricsData || null);
    } catch {
      toast('error', 'Failed to load equipment details');
    } finally {
      setDetailLoading(false);
    }
  }, [toast]);

  const openDetail = (ws: Workstation) => {
    setSelected(ws);
    setView('detail');
    setActiveTab('plans');
    loadDetailData(ws.id);
  };

  // ===== ACTIONS =====
  const createPlan = async () => {
    if (!selected || !planDesc.trim() || !planDue) return;
    setPlanSaving(true);
    try {
      const plan = await api.post<MaintenancePlan>('/maintenance/plans', {
        workstationId: selected.id,
        type: planType,
        name: planDesc.trim(),
        frequencyDays: Number(planFreq),
        nextDueDate: planDue,
      });
      setPlans(prev => [plan, ...prev]);
      setShowPlanForm(false);
      setPlanDesc(''); setPlanDue('');
      toast('success', 'Maintenance plan created');
    } catch (e: any) {
      toast('error', e.message || 'Failed to create plan');
    } finally {
      setPlanSaving(false);
    }
  };

  const logWork = async () => {
    if (!selected || !logDesc.trim() || !logDuration) return;
    setLogSaving(true);
    try {
      const log = await api.post<MaintenanceLog>('/maintenance/logs', {
        workstationId: selected.id,
        type: logType,
        description: logDesc.trim(),
        durationMinutes: Number(logDuration),
        cost: logCost ? Number(logCost) : undefined,
      });
      setLogs(prev => [log, ...prev]);
      setShowLogForm(false);
      setLogDesc(''); setLogDuration(''); setLogCost('');
      toast('success', 'Maintenance work logged');
    } catch (e: any) {
      toast('error', e.message || 'Failed to log work');
    } finally {
      setLogSaving(false);
    }
  };

  const submitCilt = async () => {
    if (!selected) return;
    setCiltSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const check = await api.post<CiltCheck>('/maintenance/cilt', {
        workstationId: selected.id,
        date: today,
        cleaningDone: ciltCleaning,
        inspectionDone: ciltInspection,
        lubricationDone: ciltLubrication,
        tighteningDone: ciltTightening,
        abnormalityFound: ciltAbnormality,
        abnormalityDescription: ciltAbnormality && ciltNotes.trim() ? ciltNotes.trim() : undefined,
      });
      setCiltChecks(prev => [check, ...prev]);
      setCiltCleaning(false); setCiltInspection(false);
      setCiltLubrication(false); setCiltTightening(false);
      setCiltAbnormality(false); setCiltNotes('');
      toast('success', 'CILT check submitted');
    } catch (e: any) {
      toast('error', e.message || 'Failed to submit CILT check');
    } finally {
      setCiltSaving(false);
    }
  };

  // Helpers
  const isOverdue = (dateStr: string) => new Date(dateStr) < new Date();
  const overdueForWs = (wsId: string) => overdue.filter(o => o.workstationId === wsId).length;

  const filteredWorkstations = workstations.filter(ws => {
    if (!debouncedSearch.trim()) return true;
    const q = debouncedSearch.toLowerCase();
    return ws.name.toLowerCase().includes(q) || ws.code.toLowerCase().includes(q) || ws.area.toLowerCase().includes(q);
  });

  // ===== LIST VIEW =====
  if (view === 'list') {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Wrench className="w-6 h-6 text-brand-600" />
              Equipment Management
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              TPM &amp; CILT — Workstation maintenance and autonomous care
            </p>
          </div>
        </div>

        {/* Metrics bar */}
        {overdue.length > 0 && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-red-700 dark:text-red-400 font-medium">
              {overdue.length} overdue maintenance plan{overdue.length !== 1 ? 's' : ''} across equipment
            </span>
          </div>
        )}

        {/* Search */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search workstations..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Workstation grid — grouped as tree: Lines → Machines */}
        {loading ? (
          <SkeletonList count={4} />
        ) : filteredWorkstations.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="No workstations found"
            description="Workstations will appear here once they are configured in the system."
          />
        ) : (() => {
          // Build tree: parents (no parentId) and children (have parentId)
          const parentIds = new Set(filteredWorkstations.filter(ws => !ws.parentId).map(ws => ws.id));
          const childrenOf = (parentId: string) => filteredWorkstations.filter(ws => ws.parentId === parentId);
          // Lines = workstations with no parent that have children among filtered set
          const lines = filteredWorkstations.filter(ws => !ws.parentId && childrenOf(ws.id).length > 0);
          // Standalone = workstations with no parent and no children
          const standalone = filteredWorkstations.filter(ws => !ws.parentId && childrenOf(ws.id).length === 0);
          // Orphaned children (parent not in filtered set) shown standalone
          const orphaned = filteredWorkstations.filter(ws => ws.parentId && !parentIds.has(ws.parentId));

          const renderCard = (ws: Workstation, indent = false) => {
            const wsOverdue = overdueForWs(ws.id);
            return (
              <GlassCard key={ws.id} onClick={() => openDetail(ws)} hover>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[ws.equipmentStatus]}`} />
                    <span className="text-xs text-gray-500 dark:text-gray-400">{STATUS_LABEL[ws.equipmentStatus]}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CRITICALITY_BADGE[ws.criticality]}`}>
                    {ws.criticality}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white truncate">{ws.name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{ws.code} — {ws.type}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{ws.area}</p>
                {wsOverdue > 0 && (
                  <div className="mt-3 flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium">
                    <AlertTriangle className="w-3 h-3" />
                    {wsOverdue} overdue
                  </div>
                )}
              </GlassCard>
            );
          };

          return (
            <div className="space-y-6">
              {/* Assembly Lines with their machines */}
              {lines.map(line => (
                <div key={line.id}>
                  <div className="flex items-center gap-3 mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[line.equipmentStatus]}`} />
                      <h2
                        className="text-lg font-semibold text-gray-900 dark:text-white cursor-pointer hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                        onClick={() => openDetail(line)}
                      >
                        {line.name}
                      </h2>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{line.code} — {line.area}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CRITICALITY_BADGE[line.criticality]}`}>
                      {line.criticality}
                    </span>
                    {overdueForWs(line.id) > 0 && (
                      <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium">
                        <AlertTriangle className="w-3 h-3" /> {overdueForWs(line.id)} overdue
                      </span>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 pl-6 border-l-2 border-gray-200 dark:border-gray-700">
                    {childrenOf(line.id).map(child => renderCard(child, true))}
                  </div>
                </div>
              ))}

              {/* Standalone workstations (no parent, no children) */}
              {(standalone.length > 0 || orphaned.length > 0) && (
                <div>
                  {lines.length > 0 && (
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 px-1">
                      Standalone Equipment
                    </h2>
                  )}
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {standalone.map(ws => renderCard(ws))}
                    {orphaned.map(ws => renderCard(ws))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    );
  }

  // ===== DETAIL VIEW =====
  if (view === 'detail' && selected) {
    return (
      <div>
        <Breadcrumb items={[
          { label: 'Equipment', onClick: () => { setView('list'); setSelected(null); } },
          { label: selected.name },
        ]} />

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Wrench className="w-6 h-6 text-brand-600" />
              {selected.name}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              {selected.code} — {selected.type} — {selected.area}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${CRITICALITY_BADGE[selected.criticality]}`}>
              Criticality {selected.criticality}
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              <span className={`w-2 h-2 rounded-full ${STATUS_DOT[selected.equipmentStatus]}`} />
              {STATUS_LABEL[selected.equipmentStatus]}
            </span>
          </div>
        </div>

        {/* Metrics cards */}
        {metrics && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <GradientStatCard label="MTBF" value={metrics.mtbf} suffix=" hrs" variant="blue" icon={Activity} decimals={1} />
            <GradientStatCard label="MTTR" value={metrics.mttr} suffix=" hrs" variant="orange" icon={Clock} decimals={1} />
            <GradientStatCard label="Availability" value={metrics.availability} suffix="%" variant="green" icon={Gauge} decimals={1} />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-gray-200 dark:border-gray-700">
          {([
            { key: 'plans' as DetailTab, label: 'Maintenance Plans', icon: Settings2 },
            { key: 'logs' as DetailTab, label: 'Maintenance Log', icon: Clock },
            { key: 'cilt' as DetailTab, label: 'CILT', icon: CheckCircle },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {detailLoading ? (
          <SkeletonList count={3} />
        ) : (
          <>
            {/* PLANS TAB */}
            {activeTab === 'plans' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-900 dark:text-white">Maintenance Plans</h3>
                  <button
                    onClick={() => setShowPlanForm(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Add Plan
                  </button>
                </div>

                {showPlanForm && (
                  <Card className="mb-4">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3">New Maintenance Plan</h4>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Type *</span>
                        <select value={planType} onChange={e => setPlanType(e.target.value)}
                          className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                          <option value="preventive">Preventive</option>
                          <option value="predictive">Predictive</option>
                          <option value="condition_based">Condition Based</option>
                          <option value="calibration">Calibration</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Frequency *</span>
                        <select value={planFreq} onChange={e => setPlanFreq(e.target.value)}
                          className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                          <option value="quarterly">Quarterly</option>
                          <option value="annually">Annually</option>
                        </select>
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Description *</span>
                        <input type="text" value={planDesc} onChange={e => setPlanDesc(e.target.value)}
                          placeholder="e.g. Replace bearing on main drive"
                          className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500" />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Next Due Date *</span>
                        <input type="date" value={planDue} onChange={e => setPlanDue(e.target.value)}
                          className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500" />
                      </label>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button onClick={createPlan} disabled={planSaving || !planDesc.trim() || !planDue}
                        className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors">
                        {planSaving ? 'Saving...' : 'Create Plan'}
                      </button>
                      <button onClick={() => { setShowPlanForm(false); setPlanDesc(''); setPlanDue(''); }}
                        className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm">
                        Cancel
                      </button>
                    </div>
                  </Card>
                )}

                {plans.length === 0 ? (
                  <EmptyState icon={Settings2} title="No maintenance plans" description="Create your first maintenance plan for this workstation." actionLabel="Add Plan" onAction={() => setShowPlanForm(true)} />
                ) : (
                  <div className="space-y-2">
                    {plans.map(plan => {
                      const due = isOverdue(plan.nextDueDate);
                      return (
                        <Card key={plan.id}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${PLAN_TYPE_BADGE[plan.type] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                                {plan.type}
                              </span>
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900 dark:text-white truncate">{plan.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Every {plan.frequencyDays}d — {plan.assignedTo ? `${plan.assignedTo.firstName} ${plan.assignedTo.lastName}` : 'Unassigned'}
                                </p>
                              </div>
                            </div>
                            <span className={`text-xs font-medium whitespace-nowrap ${due ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                              {due && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                              Due {new Date(plan.nextDueDate).toLocaleDateString()}
                            </span>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* LOGS TAB */}
            {activeTab === 'logs' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-900 dark:text-white">Maintenance Log</h3>
                  <button
                    onClick={() => setShowLogForm(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Log Work
                  </button>
                </div>

                {showLogForm && (
                  <Card className="mb-4">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3">Log Maintenance Work</h4>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Type *</span>
                        <select value={logType} onChange={e => setLogType(e.target.value)}
                          className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                          <option value="preventive">Preventive</option>
                          <option value="corrective">Corrective</option>
                          <option value="emergency">Emergency</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Duration (min) *</span>
                        <input type="number" value={logDuration} onChange={e => setLogDuration(e.target.value)}
                          placeholder="e.g. 45"
                          className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500" />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Description *</span>
                        <textarea value={logDesc} onChange={e => setLogDesc(e.target.value)} rows={2}
                          placeholder="What was done..."
                          className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500" />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Cost (optional)</span>
                        <input type="number" value={logCost} onChange={e => setLogCost(e.target.value)}
                          placeholder="e.g. 150.00"
                          className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500" />
                      </label>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button onClick={logWork} disabled={logSaving || !logDesc.trim() || !logDuration}
                        className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors">
                        {logSaving ? 'Saving...' : 'Log Work'}
                      </button>
                      <button onClick={() => { setShowLogForm(false); setLogDesc(''); setLogDuration(''); setLogCost(''); }}
                        className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm">
                        Cancel
                      </button>
                    </div>
                  </Card>
                )}

                {logs.length === 0 ? (
                  <EmptyState icon={Clock} title="No maintenance logged" description="Log maintenance work to build your equipment history." actionLabel="Log Work" onAction={() => setShowLogForm(true)} />
                ) : (
                  <div className="space-y-2">
                    {logs.map((log, i) => (
                      <Card key={log.id}>
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            i === 0 ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                          }`}>
                            <Wrench className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${PLAN_TYPE_BADGE[log.type] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                                {log.type}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {log.durationMinutes} min {log.cost ? `— $${log.cost.toFixed(2)}` : ''}
                              </span>
                            </div>
                            <p className="text-sm text-gray-900 dark:text-white">{log.description}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {log.performedBy ? `${log.performedBy.firstName} ${log.performedBy.lastName}` : 'Unknown'} — {new Date(log.performedAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* CILT TAB */}
            {activeTab === 'cilt' && (
              <div>
                <Card className="mb-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-4">Daily CILT Check</h4>
                  <div className="space-y-3">
                    {([
                      { key: 'cleaning', label: 'Cleaning', icon: Droplets, value: ciltCleaning, set: setCiltCleaning },
                      { key: 'inspection', label: 'Inspection', icon: EyeIcon, value: ciltInspection, set: setCiltInspection },
                      { key: 'lubrication', label: 'Lubrication', icon: Droplets, value: ciltLubrication, set: setCiltLubrication },
                      { key: 'tightening', label: 'Tightening', icon: Wrench, value: ciltTightening, set: setCiltTightening },
                    ] as const).map(item => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => item.set(!item.value)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                          item.value
                            ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <item.icon className={`w-4 h-4 ${item.value ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`} />
                          <span className={`text-sm font-medium ${item.value ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}`}>{item.label}</span>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          item.value ? 'border-green-500 bg-green-500' : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {item.value && <CheckCircle className="w-3 h-3 text-white" />}
                        </div>
                      </button>
                    ))}

                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                      <button
                        type="button"
                        onClick={() => setCiltAbnormality(!ciltAbnormality)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                          ciltAbnormality
                            ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={`w-4 h-4 ${ciltAbnormality ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`} />
                          <span className={`text-sm font-medium ${ciltAbnormality ? 'text-red-700 dark:text-red-300' : 'text-gray-700 dark:text-gray-300'}`}>Abnormality Detected</span>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          ciltAbnormality ? 'border-red-500 bg-red-500' : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {ciltAbnormality && <CheckCircle className="w-3 h-3 text-white" />}
                        </div>
                      </button>
                    </div>

                    <label className="block">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Notes</span>
                      <textarea value={ciltNotes} onChange={e => setCiltNotes(e.target.value)} rows={2}
                        placeholder="Any additional observations..."
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500" />
                    </label>

                    <button onClick={submitCilt} disabled={ciltSaving}
                      className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors">
                      {ciltSaving ? 'Submitting...' : 'Submit CILT Check'}
                    </button>
                  </div>
                </Card>

                {/* Recent CILT checks */}
                {ciltChecks.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3">Recent Checks</h4>
                    <div className="space-y-2">
                      {ciltChecks.slice(0, 10).map(check => (
                        <Card key={check.id} padding="sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="flex gap-1">
                                {check.cleaningDone && <span className="w-5 h-5 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-[10px] font-bold text-blue-600 dark:text-blue-400">C</span>}
                                {check.inspectionDone && <span className="w-5 h-5 rounded bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center text-[10px] font-bold text-cyan-600 dark:text-cyan-400">I</span>}
                                {check.lubricationDone && <span className="w-5 h-5 rounded bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-[10px] font-bold text-amber-600 dark:text-amber-400">L</span>}
                                {check.tighteningDone && <span className="w-5 h-5 rounded bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-[10px] font-bold text-purple-600 dark:text-purple-400">T</span>}
                              </div>
                              {check.abnormalityFound && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">ABN</span>
                              )}
                              {check.abnormalityDescription && <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">{check.abnormalityDescription}</span>}
                            </div>
                            <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                              {check.operator ? `${check.operator.firstName} ${check.operator.lastName}` : 'Unknown'} — {new Date(check.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return null;
}
