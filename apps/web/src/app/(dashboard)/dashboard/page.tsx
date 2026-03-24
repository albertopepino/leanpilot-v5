'use client';

import { useEffect, useState } from 'react';
import { api, auth } from '@/lib/api';
import {
  AlertTriangle, Wrench, Pause, Clock, CalendarOff, ShieldAlert,
  Activity, Eye, PackageX, Boxes, CircleAlert, Gauge, ShieldCheck,
  ClipboardCheck, Lightbulb, TrendingUp, TrendingDown,
  ChevronRight, ArrowUpRight,
} from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientStatCard } from '@/components/ui/GradientStatCard';
import { WelcomeBanner } from '@/components/ui/WelcomeBanner';
import Link from 'next/link';

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

const SEVERITY_BADGE: Record<string, string> = {
  high:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800',
  low:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800',
};

const WASTE_LABELS: Record<string, string> = {
  waiting: 'Waiting', overproduction: 'Overproduction', inventory: 'Inventory',
  motion: 'Motion', transportation: 'Transportation', over_processing: 'Over-processing',
  defect: 'Defects', talent: 'Unused Talent',
};

// ── Skeleton ──────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto space-y-8 animate-pulse">
      <div className="h-36 bg-gradient-to-r from-blue-200 to-violet-200 dark:from-blue-900 dark:to-violet-900 rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-36 rounded-2xl bg-gray-200 dark:bg-gray-700" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-72 rounded-2xl bg-gray-200 dark:bg-gray-700" />
        <div className="h-72 rounded-2xl bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  );
}

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

  if (loading) return <DashboardSkeleton />;

  const losses = data?.losses;
  const production = data?.production;
  const attention = data?.attention;
  const maxLoss = losses ? Math.max(...LOSS_CONFIG.map(l => losses[l.key] as number), 0.1) : 1;

  const summaryPills: string[] = [];
  if (attention?.machinesDown) summaryPills.push(`${attention.machinesDown} machine${attention.machinesDown > 1 ? 's' : ''} down`);
  if (attention?.posBehind) summaryPills.push(`${attention.posBehind} PO${attention.posBehind > 1 ? 's' : ''} behind`);
  if (attention?.mudaSignals) summaryPills.push(`${attention.mudaSignals} muda signal${attention.mudaSignals > 1 ? 's' : ''}`);
  if (!summaryPills.length) summaryPills.push('All systems running smoothly');

  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto space-y-8">

      {/* ── Welcome Banner ──────────────────────────────────────────── */}
      <WelcomeBanner
        firstName={user?.firstName || 'User'}
        siteName={user?.siteName || 'LeanPilot'}
        summary={summaryPills}
      />

      {/* ── KPI Cards ───────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4">
          This Week's Performance
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          <GradientStatCard
            label="Total Produced"
            value={production?.totalProduced ?? 0}
            gradient="blue"
            icon={Boxes}
            trend="up"
            trendLabel="vs. last week"
            delay={0}
          />
          <GradientStatCard
            label="Quality Rate"
            value={production ? Math.max(0, 100 - production.scrapRate) : 0}
            suffix="%"
            decimals={1}
            gradient="green"
            icon={ShieldCheck}
            trend={production && production.scrapRate < 2 ? 'up' : 'down'}
            trendLabel={`${production?.scrapRate ?? 0}% scrap`}
            delay={75}
          />
          <GradientStatCard
            label="Active Orders"
            value={attention?.activePOs ?? 0}
            gradient="orange"
            icon={ClipboardCheck}
            trend={attention?.posBehind ? 'down' : 'up'}
            trendLabel={attention?.posBehind ? `${attention.posBehind} behind` : 'On schedule'}
            delay={150}
          />
          <GradientStatCard
            label="Kaizen Ideas"
            value={attention?.mudaSignals ?? 0}
            gradient="purple"
            icon={Lightbulb}
            trend="flat"
            trendLabel="Open signals"
            delay={225}
          />
        </div>
      </div>

      {/* ── Attention Strip ─────────────────────────────────────────── */}
      {attention && (attention.machinesDown > 0 || attention.posBehind > 0) && (
        <div className="flex flex-wrap gap-3">
          {attention.machinesDown > 0 && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20
                            border border-red-200 dark:border-red-800
                            rounded-xl px-4 py-2.5 text-sm">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="font-medium text-red-700 dark:text-red-400">
                {attention.machinesDown} machine{attention.machinesDown > 1 ? 's' : ''} down
              </span>
              <Link href="/shopfloor" className="ml-2 text-red-500 hover:text-red-700">
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
          )}
          {attention.posBehind > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20
                            border border-amber-200 dark:border-amber-800
                            rounded-xl px-4 py-2.5 text-sm">
              <PackageX className="w-4 h-4 text-amber-500" />
              <span className="font-medium text-amber-700 dark:text-amber-400">
                {attention.posBehind} PO{attention.posBehind > 1 ? 's' : ''} behind schedule
              </span>
              <Link href="/shopfloor" className="ml-2 text-amber-500 hover:text-amber-700">
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── Charts Row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Losses Chart */}
        <GlassCard>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600
                              flex items-center justify-center">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-200">
                Losses This Week
              </h3>
            </div>
            {losses && (
              <span className="text-sm font-medium text-gray-400">
                {losses.totalHours.toFixed(1)}h total
              </span>
            )}
          </div>
          <div className="space-y-3.5">
            {LOSS_CONFIG.map(({ key, label, color, icon: Icon }) => {
              const hours = (losses?.[key] as number) ?? 0;
              const pct = maxLoss > 0 ? (hours / maxLoss) * 100 : 0;
              return (
                <div key={key} className="flex items-center gap-3 group">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center
                                  bg-gray-100 dark:bg-gray-700 group-hover:scale-110 transition-transform">
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                  </div>
                  <span className="w-24 text-sm font-medium text-gray-600 dark:text-gray-300 truncate">
                    {label}
                  </span>
                  <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                      }}
                    />
                  </div>
                  <span className="w-14 text-right text-sm font-semibold tabular-nums text-gray-700 dark:text-gray-300">
                    {hours.toFixed(1)}h
                  </span>
                </div>
              );
            })}
          </div>
        </GlassCard>

        {/* Production Summary */}
        <GlassCard>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-400
                              flex items-center justify-center">
                <Gauge className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-200">
                Production Summary
              </h3>
            </div>
            <Link
              href="/dashboard/oee"
              className="text-xs font-medium text-brand-600 hover:text-brand-700
                         flex items-center gap-1 transition-colors"
            >
              View OEE <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
              <p className="text-2xl font-extrabold tracking-tight tabular-nums text-gray-900 dark:text-white">
                {production?.totalProduced ?? 0}
              </p>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1.5">
                Units Produced
              </p>
            </div>
            <div className="text-center p-4 rounded-xl bg-red-50 dark:bg-red-900/20">
              <p className="text-2xl font-extrabold tracking-tight tabular-nums text-red-600 dark:text-red-400">
                {production?.totalScrap ?? 0}
              </p>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1.5">
                Scrap Units
              </p>
            </div>
            <div className="text-center p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
              <p className="text-2xl font-extrabold tracking-tight tabular-nums text-gray-900 dark:text-white">
                {production?.scrapRate ?? 0}%
              </p>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1.5">
                Scrap Rate
              </p>
            </div>
          </div>

          {/* Quick stats under production */}
          <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {attention?.totalWorkstations ?? 0} workstations total
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${attention?.machinesDown ? 'bg-red-500' : 'bg-emerald-500'}`} />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {Math.max(0, (attention?.totalWorkstations ?? 0) - (attention?.machinesDown ?? 0))} online
                </span>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* ── Muda Signals ────────────────────────────────────────────── */}
      <GlassCard>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500
                            flex items-center justify-center">
              <CircleAlert className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-200">
              Open Muda Signals
            </h3>
          </div>
          <Link
            href="/gemba"
            className="text-xs font-medium text-brand-600 hover:text-brand-700
                       flex items-center gap-1 transition-colors"
          >
            View All <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {mudaSignals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/20
                            flex items-center justify-center mb-3">
              <ShieldCheck className="w-6 h-6 text-emerald-500" />
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">All clear!</p>
            <p className="text-xs text-gray-400 mt-1">No open observations</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {mudaSignals.slice(0, 6).map((obs, i) => (
              <div
                key={obs.id}
                className="flex items-start gap-3 p-3.5 rounded-xl
                           bg-gray-50/80 dark:bg-gray-700/30
                           hover:bg-gray-100 dark:hover:bg-gray-700/50
                           transition-colors group"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <span className={`mt-0.5 px-2.5 py-0.5 text-xs font-semibold rounded-full
                                  ${SEVERITY_BADGE[obs.severity] || SEVERITY_BADGE.medium}`}>
                  {obs.severity}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white leading-snug">
                    {obs.description}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {WASTE_LABELS[obs.wasteCategory] || obs.wasteCategory}
                    <span className="mx-1.5">·</span>
                    {obs.status}
                    {obs.walk?.date && (
                      <>
                        <span className="mx-1.5">·</span>
                        {new Date(obs.walk.date).toLocaleDateString()}
                      </>
                    )}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500
                                         transition-colors flex-shrink-0 mt-1" />
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* ── Quick Actions ───────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Start Gemba Walk', href: '/gemba', icon: Eye, color: 'from-blue-600 to-blue-400' },
            { label: 'New 5S Audit', href: '/tools/five-s', icon: ClipboardCheck, color: 'from-orange-600 to-amber-400' },
            { label: 'Submit Kaizen', href: '/tools/kaizen', icon: Lightbulb, color: 'from-violet-600 to-purple-400' },
            { label: 'Quality Check', href: '/quality', icon: ShieldCheck, color: 'from-emerald-600 to-emerald-400' },
          ].map(({ label, href, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-3 p-4
                         bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl
                         rounded-2xl border border-white/20 dark:border-gray-700/50
                         shadow-sm hover:shadow-md hover:-translate-y-0.5
                         transition-all duration-200"
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color}
                              flex items-center justify-center flex-shrink-0
                              group-hover:scale-110 transition-transform`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
