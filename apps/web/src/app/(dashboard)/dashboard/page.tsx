'use client';

import { useEffect, useState } from 'react';
import { api, auth } from '@/lib/api';
import {
  AlertTriangle, Wrench, Pause, Clock, CalendarOff, ShieldAlert,
  Activity, Eye, PackageX, Boxes, CircleAlert, Loader2,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────

interface DashboardOverview {
  losses: {
    breakdown: number;
    changeover: number;
    planned_stop: number;
    idle: number;
    maintenance: number;
    quality_hold: number;
    totalHours: number;
  };
  production: {
    totalProduced: number;
    totalScrap: number;
    scrapRate: number;
  };
  attention: {
    machinesDown: number;
    mudaSignals: number;
    posBehind: number;
    activePOs: number;
    totalWorkstations: number;
  };
}

interface MudaSignal {
  id: string;
  wasteCategory: string;
  severity: string;
  description: string;
  status: string;
  createdAt: string;
  walk?: { date: string };
}

// ── Constants ──────────────────────────────────────────────────────────

const LOSS_CONFIG: { key: keyof DashboardOverview['losses']; label: string; color: string; icon: React.ElementType }[] = [
  { key: 'breakdown',    label: 'Breakdown',    color: '#ef4444', icon: AlertTriangle },
  { key: 'changeover',   label: 'Changeover',   color: '#eab308', icon: Wrench },
  { key: 'idle',         label: 'Idle',          color: '#6b7280', icon: Pause },
  { key: 'maintenance',  label: 'Maintenance',   color: '#3b82f6', icon: Clock },
  { key: 'quality_hold', label: 'Quality Hold',  color: '#a855f7', icon: ShieldAlert },
  { key: 'planned_stop', label: 'Planned Stop',  color: '#f97316', icon: CalendarOff },
];

const SEVERITY_COLORS: Record<string, string> = {
  high:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  low:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const WASTE_LABELS: Record<string, string> = {
  waiting: 'Waiting', overproduction: 'Overproduction', inventory: 'Inventory',
  motion: 'Motion', transportation: 'Transportation', over_processing: 'Over-processing',
  defect: 'Defects', talent: 'Unused Talent',
};

// ── Page ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [mudaSignals, setMudaSignals] = useState<MudaSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const user = auth.getUser();

  useEffect(() => {
    Promise.all([
      api.get<DashboardOverview>('/dashboard/overview').catch(() => null),
      api.get<MudaSignal[]>('/gemba/muda-signals').catch(() => []),
    ]).then(([overview, signals]) => {
      setData(overview);
      setMudaSignals(Array.isArray(signals) ? signals : []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
      </div>
    );
  }

  const losses = data?.losses;
  const production = data?.production;
  const attention = data?.attention;
  const maxLoss = losses ? Math.max(...LOSS_CONFIG.map(l => losses[l.key] as number), 0.1) : 1;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome back, {user?.firstName}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {user?.siteName} — Office Overview
        </p>
      </div>

      {/* ── Attention Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <AttentionCard
          label="Machines Down"
          value={attention?.machinesDown ?? 0}
          icon={AlertTriangle}
          urgent={!!attention?.machinesDown}
        />
        <AttentionCard
          label="POs Behind Schedule"
          value={attention?.posBehind ?? 0}
          icon={PackageX}
          urgent={!!attention?.posBehind}
        />
        <AttentionCard
          label="Active POs"
          value={attention?.activePOs ?? 0}
          icon={Boxes}
        />
        <AttentionCard
          label="Muda Signals"
          value={attention?.mudaSignals ?? 0}
          icon={Eye}
          urgent={(attention?.mudaSignals ?? 0) > 3}
        />
      </div>

      {/* ── Production Summary ─────────────────────────────────────── */}
      {production && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{production.totalProduced}</div>
            <div className="text-xs text-gray-500 mt-1">Produced (week)</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
            <div className="text-2xl font-bold text-red-500">{production.totalScrap}</div>
            <div className="text-xs text-gray-500 mt-1">Scrap (week)</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{production.scrapRate}%</div>
            <div className="text-xs text-gray-500 mt-1">Scrap Rate</div>
          </div>
        </div>
      )}

      {/* ── Losses Bar Chart ───────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-brand-600" />
            Losses This Week
          </h2>
          {losses && (
            <span className="text-sm text-gray-500">{losses.totalHours.toFixed(1)}h total</span>
          )}
        </div>
        <div className="space-y-3">
          {LOSS_CONFIG.map(({ key, label, color, icon: Icon }) => {
            const hours = (losses?.[key] as number) ?? 0;
            const pct = maxLoss > 0 ? (hours / maxLoss) * 100 : 0;
            return (
              <div key={key} className="flex items-center gap-3">
                <Icon className="w-4 h-4 flex-shrink-0 text-gray-400" />
                <span className="w-28 text-sm text-gray-600 dark:text-gray-300 truncate">{label}</span>
                <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
                <span className="w-16 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                  {hours.toFixed(1)}h
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Muda Signals ───────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
          <CircleAlert className="w-5 h-5 text-amber-500" />
          Open Muda Signals
        </h2>
        {mudaSignals.length === 0 ? (
          <p className="text-gray-400 text-sm py-4 text-center">No open observations</p>
        ) : (
          <div className="space-y-2">
            {mudaSignals.slice(0, 8).map(obs => (
              <div
                key={obs.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
              >
                <span className={`mt-0.5 px-2 py-0.5 text-xs font-medium rounded-full ${SEVERITY_COLORS[obs.severity] || SEVERITY_COLORS.medium}`}>
                  {obs.severity}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white">{obs.description}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {WASTE_LABELS[obs.wasteCategory] || obs.wasteCategory} · {obs.status}
                    {obs.walk?.date && ` · ${obs.walk.date}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function AttentionCard({ label, value, icon: Icon, urgent }: {
  label: string;
  value: number;
  icon: React.ElementType;
  urgent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${
      urgent
        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${urgent ? 'text-red-500' : 'text-gray-400'}`} />
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${urgent ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
        {value}
      </div>
    </div>
  );
}
