'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import FileUpload from '@/components/FileUpload';
import {
  ShieldAlert, Plus, Search, ChevronRight, X,
  AlertTriangle, AlertOctagon, HardHat, Flame,
  Calendar, MapPin, Clock, User, FileText, HelpCircle, Info,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';
import { GradientStatCard } from '@/components/ui/GradientStatCard';

// ===== TYPES =====
interface SafetyIncident {
  id: string;
  type: 'injury' | 'near_miss' | 'property_damage';
  severity: 'minor' | 'moderate' | 'serious' | 'critical';
  title: string;
  description: string;
  location: string;
  date: string;
  status: 'open' | 'investigating' | 'corrective_action' | 'closed';
  injuredPerson: string | null;
  injuryType: string | null;
  daysLost: number;
  photoUrl: string | null;
  investigationNotes: string | null;
  fiveWhyId: string | null;
  reporter: { id: string; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

interface SafetyMetrics {
  daysSinceLastIncident: number;
  totalIncidents: number;
  nearMissRatioPercent: number;
  totalDaysLost: number;
  trirRawCount: number;
  ltirRawCount: number;
  recordableIncidents: number;
  lostTimeIncidents: number;
  nearMisses: number;
}

// ===== CONSTANTS =====
const TYPE_CONFIG: Record<string, { label: string; icon: typeof AlertTriangle; color: string; bgColor: string }> = {
  injury: { label: 'Injury', icon: HardHat, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  near_miss: { label: 'Near Miss', icon: AlertTriangle, color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' },
  property_damage: { label: 'Property Damage', icon: Flame, color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
};

const SEVERITY_BADGE: Record<string, string> = {
  minor: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  moderate: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  serious: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  investigating: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  corrective_action: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  closed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  investigating: 'Investigating',
  corrective_action: 'Corrective Action',
  closed: 'Closed',
};

// Near-miss ratio interpretation based on Heinrich's triangle / Bird's pyramid
const NearMissInterpretation = ({ ratio }: { ratio: number }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  let color: string;
  let bgColor: string;
  let label: string;
  let message: string;

  if (ratio > 80) {
    color = 'text-green-700 dark:text-green-400';
    bgColor = 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    label = 'Good';
    message = 'Good reporting culture. Near-miss reporting is strong relative to incidents.';
  } else if (ratio >= 50) {
    color = 'text-yellow-700 dark:text-yellow-400';
    bgColor = 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
    label = 'Improving';
    message = 'Improving. Continue encouraging near-miss reporting across all shifts and areas.';
  } else {
    color = 'text-red-700 dark:text-red-400';
    bgColor = 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
    label = 'Alert';
    message = 'Near-misses likely underreported. Heinrich ratio target: 10:1 (near-miss:injury). Encourage a blame-free reporting culture.';
  }

  return (
    <div className={`p-3 rounded-lg border ${bgColor} flex items-start gap-2`}>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-sm font-semibold ${color}`}>
            {ratio.toFixed(1)}% Near-Miss Ratio — {label}
          </span>
          <div className="relative inline-block">
            <button
              type="button"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onClick={() => setShowTooltip(v => !v)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Learn about Heinrich's triangle"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            {showTooltip && (
              <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg text-xs">
                <div className="font-semibold text-gray-900 dark:text-white mb-1">Heinrich&apos;s Triangle / Bird&apos;s Pyramid</div>
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  For every serious injury, there are roughly 10 minor injuries, 30 property damage incidents, and 600 near-misses.
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  A healthy near-miss ratio (&gt;80%) indicates workers feel safe reporting minor events before they become serious incidents.
                </p>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500" /> <span className="text-gray-500">&gt;80%: Strong culture</span></div>
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-500" /> <span className="text-gray-500">50-80%: Improving</span></div>
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500" /> <span className="text-gray-500">&lt;50%: Underreported</span></div>
                </div>
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 rotate-45 bg-white dark:bg-gray-800 border-r border-b border-gray-200 dark:border-gray-600" />
              </div>
            )}
          </div>
        </div>
        <p className={`text-xs ${color}`}>{message}</p>
      </div>
    </div>
  );
};

type View = 'list' | 'detail' | 'create';

export default function SafetyPage() {
  const [incidents, setIncidents] = useState<SafetyIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('list');
  const [selected, setSelected] = useState<SafetyIncident | null>(null);
  const [metrics, setMetrics] = useState<SafetyMetrics | null>(null);
  const { toast } = useToast();

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const searchTimer = useRef<NodeJS.Timeout>(undefined);

  useEffect(() => {
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  // Create form state
  const [newType, setNewType] = useState<'injury' | 'near_miss' | 'property_damage'>('near_miss');
  const [newSeverity, setNewSeverity] = useState<'minor' | 'moderate' | 'serious' | 'critical'>('moderate');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newInjuredPerson, setNewInjuredPerson] = useState('');
  const [newInjuryDesc, setNewInjuryDesc] = useState('');
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // ===== DATA LOADING =====
  const loadIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<SafetyIncident[]>('/safety/incidents');
      setIncidents(Array.isArray(data) ? data : []);
    } catch {
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMetrics = useCallback(async () => {
    try {
      const data = await api.get<SafetyMetrics>('/safety/metrics');
      setMetrics(data || null);
    } catch {
      setMetrics(null);
    }
  }, []);

  useEffect(() => { loadIncidents(); loadMetrics(); }, [loadIncidents, loadMetrics]);

  const openDetail = async (incident: SafetyIncident) => {
    try {
      const full = await api.get<SafetyIncident>(`/safety/incidents/${incident.id}`);
      setSelected(full);
      setView('detail');
    } catch {
      toast('error', 'Failed to load incident details');
    }
  };

  // ===== ACTIONS =====
  const createIncident = async () => {
    if (!newTitle.trim() || !newDesc.trim() || !newLocation.trim()) return;
    setCreating(true);
    setError('');
    try {
      const incident = await api.post<SafetyIncident>('/safety/incidents', {
        type: newType,
        severity: newSeverity,
        title: newTitle.trim(),
        description: newDesc.trim(),
        location: newLocation.trim(),
        date: newDate,
        injuredPerson: newType === 'injury' && newInjuredPerson.trim() ? newInjuredPerson.trim() : undefined,
        injuryType: newType === 'injury' && newInjuryDesc.trim() ? newInjuryDesc.trim() : undefined,
        immediateAction: undefined,
        photoUrl: newPhotoUrl || undefined,
      });
      setIncidents(prev => [incident, ...prev]);
      setView('list');
      resetForm();
      toast('success', 'Incident reported');
      loadMetrics();
    } catch (e: any) {
      setError(e.message || 'Failed to report incident');
    } finally {
      setCreating(false);
    }
  };

  const updateStatus = async (incidentId: string, newStatus: string) => {
    try {
      const updated = await api.patch<SafetyIncident>(`/safety/incidents/${incidentId}`, { status: newStatus });
      setIncidents(prev => prev.map(i => i.id === updated.id ? updated : i));
      if (selected?.id === incidentId) setSelected(updated);
      toast('success', `Status changed to ${STATUS_LABEL[newStatus] || newStatus}`);
    } catch (e: any) {
      toast('error', e.message || 'Failed to update status');
    }
  };

  const resetForm = () => {
    setNewType('near_miss');
    setNewSeverity('moderate');
    setNewTitle('');
    setNewDesc('');
    setNewLocation('');
    setNewDate(new Date().toISOString().split('T')[0]);
    setNewInjuredPerson('');
    setNewInjuryDesc('');
    setNewPhotoUrl('');
    setError('');
  };

  // Filtered incidents
  const filtered = incidents.filter(i => {
    if (filterType !== 'all' && i.type !== filterType) return false;
    if (filterSeverity !== 'all' && i.severity !== filterSeverity) return false;
    if (filterStatus !== 'all' && i.status !== filterStatus) return false;
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      if (!i.title.toLowerCase().includes(q) && !i.description.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // ===== LIST VIEW =====
  if (view === 'list') {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-red-500" />
              Safety Management
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Incident reporting, tracking &amp; safety metrics
            </p>
          </div>
          <button
            onClick={() => { setView('create'); setError(''); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Report Incident
          </button>
        </div>

        {/* Metrics */}
        {metrics && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <GradientStatCard label="Days Since Last Incident" value={metrics.daysSinceLastIncident} variant="green" icon={ShieldAlert} />
              <GradientStatCard label="Incidents This Year" value={metrics.totalIncidents || 0} variant="orange" icon={AlertOctagon} />
              <GradientStatCard label="Near-Miss Ratio" value={metrics.nearMissRatioPercent || 0} suffix="%" variant="blue" icon={AlertTriangle} decimals={1} />
              <GradientStatCard label="Total Days Lost" value={metrics.totalDaysLost} variant="slate" icon={Calendar} />
            </div>
            {/* Near-miss ratio interpretation */}
            <div className="mb-6">
              <NearMissInterpretation ratio={metrics.nearMissRatioPercent || 0} />
            </div>
          </>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search incidents..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white">
            <option value="all">All Types</option>
            <option value="injury">Injury</option>
            <option value="near_miss">Near Miss</option>
            <option value="property_damage">Property Damage</option>
          </select>
          <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white">
            <option value="all">All Severity</option>
            <option value="minor">Minor</option>
            <option value="moderate">Moderate</option>
            <option value="serious">Serious</option>
            <option value="critical">Critical</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white">
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="corrective_action">Corrective Action</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {/* Incident list */}
        {loading ? (
          <SkeletonList count={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title="No incidents found"
            description="No safety incidents have been reported yet. Use the button above to report one."
            actionLabel="Report Incident"
            onAction={() => setView('create')}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map(incident => {
              const typeConf = TYPE_CONFIG[incident.type] || TYPE_CONFIG.near_miss;
              const TypeIcon = typeConf.icon;
              return (
                <Card key={incident.id} onClick={() => openDetail(incident)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${typeConf.bgColor}`}>
                        <TypeIcon className={`w-4 h-4 ${typeConf.color}`} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">{incident.title}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {typeConf.label} — {new Date(incident.date).toLocaleDateString()} — {incident.location}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${SEVERITY_BADGE[incident.severity]}`}>
                        {incident.severity}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[incident.status]}`}>
                        {STATUS_LABEL[incident.status]}
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

  // ===== CREATE VIEW =====
  if (view === 'create') {
    return (
      <div>
        <Breadcrumb items={[
          { label: 'Safety', onClick: () => { setView('list'); resetForm(); } },
          { label: 'Report Incident' },
        ]} />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Report Safety Incident</h1>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-2xl">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
              <span className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</span>
              <button onClick={() => setError('')}><X className="w-4 h-4 text-red-400" /></button>
            </div>
          )}

          {/* Type selector */}
          <div className="mb-6">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">Incident Type *</span>
            <div className="grid grid-cols-3 gap-3">
              {(['injury', 'near_miss', 'property_damage'] as const).map(type => {
                const conf = TYPE_CONFIG[type];
                const Icon = conf.icon;
                const active = newType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setNewType(type)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      active
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-sm'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${conf.bgColor}`}>
                      <Icon className={`w-5 h-5 ${conf.color}`} />
                    </div>
                    <span className={`text-sm font-medium ${active ? 'text-brand-700 dark:text-brand-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {conf.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Severity */}
          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Severity *</span>
            <select value={newSeverity} onChange={e => setNewSeverity(e.target.value as any)}
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="minor">Minor</option>
              <option value="moderate">Moderate</option>
              <option value="serious">Serious</option>
              <option value="critical">Critical</option>
            </select>
          </label>

          {/* Title */}
          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Title *</span>
            <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
              placeholder="Brief incident title"
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500" />
          </label>

          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Date *</span>
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Location *</span>
              <input type="text" value={newLocation} onChange={e => setNewLocation(e.target.value)}
                placeholder="e.g. Assembly Line B"
                className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500" />
            </label>
          </div>

          {/* Description */}
          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Description *</span>
            <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={3}
              placeholder="Describe what happened..."
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500" />
          </label>

          {/* Injury-specific fields */}
          {newType === 'injury' && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
              <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-3 flex items-center gap-1.5">
                <HardHat className="w-4 h-4" /> Injury Details
              </h4>
              <label className="block mb-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Injured Person</span>
                <input type="text" value={newInjuredPerson} onChange={e => setNewInjuredPerson(e.target.value)}
                  placeholder="Name of injured person"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Injury Description</span>
                <textarea value={newInjuryDesc} onChange={e => setNewInjuryDesc(e.target.value)} rows={2}
                  placeholder="Nature and extent of injury..."
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500" />
              </label>
            </div>
          )}

          {/* Photo upload */}
          <div className="mb-6">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Photo Evidence (optional)</span>
            <FileUpload
              func="safety"
              label="Upload photo"
              value={newPhotoUrl}
              onUpload={(url) => setNewPhotoUrl(url)}
              onClear={() => setNewPhotoUrl('')}
            />
          </div>

          <button onClick={createIncident} disabled={creating || !newTitle.trim() || !newDesc.trim() || !newLocation.trim()}
            className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors">
            {creating ? 'Reporting...' : 'Report Incident'}
          </button>
        </div>
      </div>
    );
  }

  // ===== DETAIL VIEW =====
  if (view === 'detail' && selected) {
    const typeConf = TYPE_CONFIG[selected.type] || TYPE_CONFIG.near_miss;
    const TypeIcon = typeConf.icon;

    const nextStatuses: Record<string, string[]> = {
      open: ['investigating'],
      investigating: ['corrective_action'],
      corrective_action: ['closed'],
      closed: [],
    };
    const available = nextStatuses[selected.status] || [];

    return (
      <div>
        <Breadcrumb items={[
          { label: 'Safety', onClick: () => { setView('list'); setSelected(null); } },
          { label: selected.title },
        ]} />

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${typeConf.bgColor}`}>
                <TypeIcon className={`w-4 h-4 ${typeConf.color}`} />
              </div>
              {selected.title}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Reported by {selected.reporter.firstName} {selected.reporter.lastName} — {new Date(selected.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${SEVERITY_BADGE[selected.severity]}`}>
              {selected.severity}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[selected.status]}`}>
              {STATUS_LABEL[selected.status]}
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Left: Details + Actions */}
          <div className="space-y-4">
            <Card>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Details</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-gray-500 dark:text-gray-400">Type</dt><dd className="text-gray-900 dark:text-white capitalize">{typeConf.label}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500 dark:text-gray-400">Severity</dt><dd className="text-gray-900 dark:text-white capitalize">{selected.severity}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500 dark:text-gray-400">Date</dt><dd className="text-gray-900 dark:text-white">{new Date(selected.date).toLocaleDateString()}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500 dark:text-gray-400">Location</dt><dd className="text-gray-900 dark:text-white">{selected.location}</dd></div>
                {selected.daysLost > 0 && (
                  <div className="flex justify-between"><dt className="text-gray-500 dark:text-gray-400">Days Lost</dt><dd className="text-red-600 dark:text-red-400 font-medium">{selected.daysLost}</dd></div>
                )}
              </dl>
            </Card>

            {available.length > 0 && (
              <Card>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Progress</h3>
                <div className="flex flex-col gap-2">
                  {available.map(ns => (
                    <button key={ns} onClick={() => updateStatus(selected.id, ns)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
                      <ChevronRight className="w-4 h-4" /> {STATUS_LABEL[ns]}
                    </button>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Right: Description + Investigation */}
          <div className="md:col-span-2 space-y-4">
            <Card>
              <h3 className="font-medium text-gray-900 dark:text-white mb-3">Description</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{selected.description}</p>
            </Card>

            {selected.injuredPerson && (
              <Card>
                <h3 className="font-medium text-red-700 dark:text-red-400 mb-3 flex items-center gap-1.5">
                  <HardHat className="w-4 h-4" /> Injury Details
                </h3>
                <dl className="space-y-2 text-sm">
                  <div><dt className="text-gray-500 dark:text-gray-400">Injured Person</dt><dd className="text-gray-900 dark:text-white mt-0.5">{selected.injuredPerson}</dd></div>
                  {selected.injuryType && (
                    <div><dt className="text-gray-500 dark:text-gray-400">Injury</dt><dd className="text-gray-900 dark:text-white mt-0.5">{selected.injuryType}</dd></div>
                  )}
                </dl>
              </Card>
            )}

            {selected.investigationNotes && (
              <Card>
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">Investigation Notes</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{selected.investigationNotes}</p>
              </Card>
            )}

            {selected.photoUrl && (
              <Card>
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">Photo Evidence</h3>
                <img src={selected.photoUrl} alt="Incident photo" className="rounded-lg max-w-full max-h-80 object-contain" />
              </Card>
            )}

            {selected.fiveWhyId && (
              <Card>
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Linked Root Cause Analysis</h3>
                <p className="text-sm text-brand-600 dark:text-brand-400">Five-Why ID: {selected.fiveWhyId}</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
