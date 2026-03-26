'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  AlertTriangle, CheckCircle2, XCircle, Clock, Factory,
  ShieldAlert, FileWarning, Wrench, ArrowDownCircle, RefreshCw,
} from 'lucide-react';
import { SkeletonList } from '@/components/ui/Skeleton';

// ===== Types =====

interface StatusChange {
  status: string | null;
  reasonCode: string | null;
  notes: string | null;
  timestamp: string;
  operator: string | null;
}

interface HandoverNote {
  poNumber: string;
  productName: string;
  produced: number;
  scrap: number;
}

interface WorkstationSummary {
  workstationId: string;
  workstationName: string;
  workstationCode: string;
  area: string;
  equipmentStatus: string;
  currentStatus: string;
  currentPO: { poNumber: string; productName: string } | null;
  produced: number;
  scrap: number;
  statusChanges: StatusChange[];
  handoverNotes: HandoverNote[];
}

interface NcrItem {
  id: string;
  title: string;
  severity: string;
  status: string;
  description: string;
  defectQuantity: number;
  createdAt: string;
  workstation: { name: string; code: string } | null;
  reporter: { firstName: string; lastName: string };
}

interface SafetyItem {
  id: string;
  title: string;
  type: string;
  severity: string;
  outcome: string;
  status: string;
  location: string;
  createdAt: string;
  reporter: { firstName: string; lastName: string };
  workstation: { name: string; code: string } | null;
}

interface Breakdown {
  status: string | null;
  reasonCode: string | null;
  notes: string | null;
  timestamp: string;
  operator: string | null;
  workstationName: string;
  workstationCode: string;
}

interface ShiftHandoverData {
  period: { since: string; hours: number };
  workstations: WorkstationSummary[];
  attentionItems: {
    breakdowns: Breakdown[];
    ncrs: NcrItem[];
    safetyIncidents: SafetyItem[];
  };
  totals: {
    totalProduced: number;
    totalScrap: number;
    workstationsRunning: number;
    workstationsDown: number;
    totalWorkstations: number;
  };
}

// ===== Helpers =====

const STATUS_COLORS: Record<string, string> = {
  running: 'bg-emerald-500',
  idle: 'bg-gray-400',
  breakdown: 'bg-red-500',
  changeover: 'bg-blue-500',
  quality_hold: 'bg-amber-500',
  maintenance: 'bg-orange-500',
  planned_stop: 'bg-gray-500',
};

const STATUS_LABELS: Record<string, string> = {
  running: 'Running',
  idle: 'Idle',
  breakdown: 'Breakdown',
  changeover: 'Changeover',
  quality_hold: 'Quality Hold',
  maintenance: 'Maintenance',
  planned_stop: 'Planned Stop',
};

const SEVERITY_BADGE: Record<string, string> = {
  minor: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  major: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  moderate: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  serious: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

function detectShift(): string {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) return 'morning';
  if (hour >= 14 && hour < 22) return 'afternoon';
  return 'night';
}

const SHIFT_OPTIONS = [
  { key: 'morning', label: 'Morning (06:00–14:00)', hours: 8 },
  { key: 'afternoon', label: 'Afternoon (14:00–22:00)', hours: 8 },
  { key: 'night', label: 'Night (22:00–06:00)', hours: 8 },
  { key: 'last12', label: 'Last 12 hours', hours: 12 },
  { key: 'last24', label: 'Last 24 hours', hours: 24 },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ===== Component =====

export default function ShiftHandoverPage() {
  const [data, setData] = useState<ShiftHandoverData | null>(null);
  const [loading, setLoading] = useState(true);
  const [shift, setShift] = useState(detectShift());
  const [refreshing, setRefreshing] = useState(false);

  const hours = SHIFT_OPTIONS.find(s => s.key === shift)?.hours || 8;

  const loadData = useCallback(() => {
    setRefreshing(true);
    api.get<ShiftHandoverData>(`/dashboard/shift-handover?hours=${hours}`)
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, [hours]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(loadData, 60_000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Shift Handover</h1>
        <SkeletonList count={4} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Shift Handover</h1>
        <p className="text-gray-500 dark:text-gray-400">Failed to load shift data. Please try again.</p>
      </div>
    );
  }

  const { workstations, attentionItems, totals } = data;
  const hasAttention = attentionItems.breakdowns.length > 0
    || attentionItems.ncrs.length > 0
    || attentionItems.safetyIncidents.length > 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Shift Handover</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Overview of production, issues, and notes for the incoming shift
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={shift}
            onChange={e => setShift(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            {SHIFT_OPTIONS.map(s => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          <button
            onClick={loadData}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Totals Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{totals.totalProduced}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Produced</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">{totals.totalScrap}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Scrap</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{totals.workstationsRunning}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Running</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">{totals.workstationsDown}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Down</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{totals.totalWorkstations}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total Workstations</p>
        </div>
      </div>

      {/* Attention Items */}
      {hasAttention && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Attention Items
          </h2>

          {/* Breakdowns */}
          {attentionItems.breakdowns.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-1.5">
                <Wrench className="w-4 h-4" />
                Breakdowns ({attentionItems.breakdowns.length})
              </h3>
              <div className="space-y-2">
                {attentionItems.breakdowns.map((b, i) => (
                  <div key={i} className="flex items-start justify-between text-sm">
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {b.workstationCode || b.workstationName}
                      </span>
                      {b.reasonCode && <span className="text-gray-500 dark:text-gray-400 ml-2">({b.reasonCode})</span>}
                      {b.notes && <p className="text-gray-600 dark:text-gray-300 text-xs mt-0.5">{b.notes}</p>}
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap ml-3">{timeAgo(b.timestamp)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NCRs */}
          {attentionItems.ncrs.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                <FileWarning className="w-4 h-4" />
                Open NCRs ({attentionItems.ncrs.length})
              </h3>
              <div className="space-y-2">
                {attentionItems.ncrs.map(ncr => (
                  <div key={ncr.id} className="flex items-start justify-between text-sm">
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">{ncr.title}</span>
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${SEVERITY_BADGE[ncr.severity] || ''}`}>
                        {ncr.severity}
                      </span>
                      {ncr.workstation && (
                        <span className="text-gray-500 dark:text-gray-400 ml-2 text-xs">
                          @ {ncr.workstation.code || ncr.workstation.name}
                        </span>
                      )}
                      {ncr.defectQuantity > 0 && (
                        <span className="text-xs text-red-600 dark:text-red-400 ml-2">{ncr.defectQuantity} defective</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap ml-3">{timeAgo(ncr.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Safety Incidents */}
          {attentionItems.safetyIncidents.length > 0 && (
            <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-orange-700 dark:text-orange-400 mb-2 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                Safety Incidents ({attentionItems.safetyIncidents.length})
              </h3>
              <div className="space-y-2">
                {attentionItems.safetyIncidents.map(si => (
                  <div key={si.id} className="flex items-start justify-between text-sm">
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">{si.title}</span>
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${SEVERITY_BADGE[si.severity] || ''}`}>
                        {si.severity}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 ml-2 text-xs capitalize">{si.type.replace(/_/g, ' ')}</span>
                      <span className="text-gray-400 ml-2 text-xs">{si.location}</span>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap ml-3">{timeAgo(si.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Workstation Grid */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Factory className="w-5 h-5 text-blue-500" />
          Workstations
        </h2>
        {workstations.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No active workstations found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {workstations.map(ws => (
              <div
                key={ws.workstationId}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {ws.workstationCode || ws.workstationName}
                    </h3>
                    {ws.workstationCode && ws.workstationName !== ws.workstationCode && (
                      <p className="text-xs text-gray-400 truncate">{ws.workstationName}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[ws.currentStatus] || 'bg-gray-400'}`} />
                    <span className="text-xs text-gray-600 dark:text-gray-300 capitalize">
                      {STATUS_LABELS[ws.currentStatus] || ws.currentStatus}
                    </span>
                  </div>
                </div>

                {/* Current PO */}
                {ws.currentPO ? (
                  <div className="mb-2 text-xs">
                    <span className="text-gray-500 dark:text-gray-400">PO: </span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{ws.currentPO.poNumber}</span>
                    <span className="text-gray-400 ml-1">({ws.currentPO.productName})</span>
                  </div>
                ) : (
                  <div className="mb-2 text-xs text-gray-400">No active PO</div>
                )}

                {/* Production counts */}
                <div className="flex items-center gap-4 text-xs mb-2">
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-gray-700 dark:text-gray-300 tabular-nums">{ws.produced} produced</span>
                  </div>
                  {ws.scrap > 0 && (
                    <div className="flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5 text-red-500" />
                      <span className="text-red-600 dark:text-red-400 tabular-nums">{ws.scrap} scrap</span>
                    </div>
                  )}
                </div>

                {/* Status changes this shift */}
                {ws.statusChanges.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Events this shift</p>
                    {ws.statusChanges.slice(0, 3).map((e, i) => (
                      <div key={i} className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1.5 mb-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[e.status || ''] || 'bg-gray-400'}`} />
                        <span className="capitalize">{STATUS_LABELS[e.status || ''] || e.status}</span>
                        {e.reasonCode && <span className="text-gray-400">({e.reasonCode})</span>}
                        <span className="text-gray-400 ml-auto">{timeAgo(e.timestamp)}</span>
                      </div>
                    ))}
                    {ws.statusChanges.length > 3 && (
                      <p className="text-[10px] text-gray-400 mt-0.5">+{ws.statusChanges.length - 3} more</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Handover Notes */}
      {(() => {
        const allNotes = workstations.flatMap(ws =>
          ws.handoverNotes.map(n => ({ ...n, workstationName: ws.workstationName, workstationCode: ws.workstationCode })),
        );
        if (allNotes.length === 0) return null;
        return (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <ArrowDownCircle className="w-5 h-5 text-indigo-500" />
              Completed Runs (Handover Notes)
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Workstation</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">PO</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Product</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Produced</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Scrap</th>
                  </tr>
                </thead>
                <tbody>
                  {allNotes.map((n, i) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                      <td className="px-4 py-2 text-gray-800 dark:text-gray-200">{n.workstationCode || n.workstationName}</td>
                      <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{n.poNumber}</td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{n.productName}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-800 dark:text-gray-200">{n.produced}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {n.scrap > 0 ? (
                          <span className="text-red-600 dark:text-red-400">{n.scrap}</span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
