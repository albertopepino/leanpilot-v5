'use client';

import { useEffect, useState } from 'react';
import { api, auth } from '@/lib/api';
import {
  AlertTriangle, Wrench, Pause, Clock, CalendarOff, ShieldAlert,
  Activity, Eye, PackageX, Boxes, CircleAlert, Gauge, ShieldCheck,
  ClipboardCheck, Lightbulb, ChevronRight, ArrowUpRight, Factory,
  ArrowRight, Zap,
} from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientStatCard } from '@/components/ui/GradientStatCard';
import { WelcomeBanner } from '@/components/ui/WelcomeBanner';
import { ProgressRing, TrendChart, HBarChart, DonutChart } from '@/components/ui/charts';
import Link from 'next/link';

// ── Types ──────────────────────────────────────────────────────────────

interface OeeWorkstation {
  workstationId: string;
  workstationName: string;
  availability: number;
  performance: number;
  quality: number;
  oee: number;
}

interface OeeData {
  siteOee: { availability: number; performance: number; quality: number; oee: number };
  workstations: OeeWorkstation[];
}

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

const LOSS_CONFIG = [
  { key: 'breakdown' as const,    label: 'Breakdown',    color: '#ef4444' },
  { key: 'changeover' as const,   label: 'Changeover',   color: '#eab308' },
  { key: 'idle' as const,         label: 'Idle',          color: '#64748b' },
  { key: 'maintenance' as const,  label: 'Maintenance',   color: '#3b82f6' },
  { key: 'quality_hold' as const, label: 'Quality Hold',  color: '#a855f7' },
  { key: 'planned_stop' as const, label: 'Planned Stop',  color: '#f97316' },
];

const SEVERITY_BADGE: Record<string, string> = {
  high:   'bg-red-50 text-red-600 ring-1 ring-red-200/60',
  medium: 'bg-amber-50 text-amber-600 ring-1 ring-amber-200/60',
  low:    'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60',
};

const WASTE_LABELS: Record<string, string> = {
  waiting: 'Waiting', overproduction: 'Overproduction', inventory: 'Inventory',
  motion: 'Motion', transportation: 'Transportation', over_processing: 'Over-processing',
  defect: 'Defects', talent: 'Unused Talent',
};

// Fake week trend data (until real API endpoint exists)
const WEEK_TREND = [
  { name: 'Mon', value: 145, value2: 3 },
  { name: 'Tue', value: 178, value2: 1 },
  { name: 'Wed', value: 162, value2: 2 },
  { name: 'Thu', value: 190, value2: 0 },
  { name: 'Fri', value: 171, value2: 1 },
  { name: 'Sat', value: 88, value2: 0 },
  { name: 'Sun', value: 0, value2: 0 },
];

// Fake sparkline data (randomized around actuals)
const fakeSparkline = (base: number, n = 7) =>
  Array.from({ length: n }, () => Math.max(0, base + (Math.random() - 0.5) * base * 0.4));

// ── Skeleton ──────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto space-y-6 animate-pulse">
      <div className="h-32 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-gray-200 dark:bg-gray-800" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 h-72 rounded-2xl bg-gray-200 dark:bg-gray-800" />
        <div className="h-72 rounded-2xl bg-gray-200 dark:bg-gray-800" />
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [mudaSignals, setMudaSignals] = useState<MudaSignal[]>([]);
  const [oee, setOee] = useState<OeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const user = auth.getUser();

  useEffect(() => {
    Promise.all([
      api.get<DashboardOverview>('/dashboard/overview').catch(() => null),
      api.get<any>('/gemba/muda-signals').catch(() => []),
      api.get<OeeData>('/dashboard/oee').catch(() => null),
    ]).then(([overview, signals, oeeData]) => {
      setData(overview);
      setMudaSignals(Array.isArray(signals) ? signals : []);
      setOee(oeeData);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;

  const losses = data?.losses;
  const production = data?.production;
  const attention = data?.attention;

  const qualityRate = production && typeof production.scrapRate === 'number' ? Math.max(0, 100 - production.scrapRate) : 0;
  const hasOeeData = oee?.siteOee && (oee.siteOee.availability > 0 || oee.siteOee.performance > 0 || oee.siteOee.quality > 0);
  const summaryPills: string[] = [];
  if (attention?.machinesDown) summaryPills.push(`${attention.machinesDown} machine${attention.machinesDown > 1 ? 's' : ''} down`);
  if (attention?.posBehind) summaryPills.push(`${attention.posBehind} PO${attention.posBehind > 1 ? 's' : ''} behind`);
  if (attention?.mudaSignals) summaryPills.push(`${attention.mudaSignals} open muda signal${attention.mudaSignals !== 1 ? 's' : ''}`);
  if (!summaryPills.length) summaryPills.push('All systems running smoothly ✓');

  // Loss data for bar chart
  const lossBarData = LOSS_CONFIG
    .map(l => ({ name: l.label, value: (losses?.[l.key] as number) ?? 0, color: l.color }))
    .filter(l => l.value > 0)
    .sort((a, b) => b.value - a.value);

  // Donut data for production split
  const produced = production?.totalProduced ?? 0;
  const scrap = production?.totalScrap ?? 0;
  const donutData = [
    { name: 'Good', value: Math.max(0, produced - scrap), color: '#10b981' },
    { name: 'Scrap', value: scrap, color: '#ef4444' },
  ];

  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto space-y-6">

      {/* ── Welcome Banner ──────────────────────────────────────── */}
      <WelcomeBanner
        firstName={user?.firstName || 'User'}
        siteName={user?.siteName || 'LeanPilot'}
        summary={summaryPills}
      />

      {/* ── Attention Alerts ────────────────────────────────────── */}
      {attention && (attention.machinesDown > 0 || attention.posBehind > 0) && (
        <div className="flex flex-wrap gap-3">
          {attention.machinesDown > 0 && (
            <Link href="/shopfloor" className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20
              border border-red-200/60 dark:border-red-800 rounded-xl px-4 py-2.5 text-sm
              hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors group">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="font-semibold text-red-700 dark:text-red-400">
                {attention.machinesDown} machine{attention.machinesDown > 1 ? 's' : ''} down
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 text-red-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          )}
          {attention.posBehind > 0 && (
            <Link href="/shopfloor" className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20
              border border-amber-200/60 dark:border-amber-800 rounded-xl px-4 py-2.5 text-sm
              hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors group">
              <PackageX className="w-4 h-4 text-amber-500" />
              <span className="font-semibold text-amber-700 dark:text-amber-400">
                {attention.posBehind} PO{attention.posBehind > 1 ? 's' : ''} behind
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 text-amber-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          )}
        </div>
      )}

      {/* ── KPI Cards (dark, muted, with sparklines) ────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <GradientStatCard
          label="Total Produced"
          value={produced}
          variant="blue"
          icon={Boxes}
          trend="up"
          trendLabel="vs. last week"
          sparkData={fakeSparkline(produced / 7)}
          delay={0}
        />
        <GradientStatCard
          label="Quality Rate"
          value={qualityRate}
          suffix="%"
          decimals={1}
          variant="green"
          icon={ShieldCheck}
          trend={qualityRate >= 98 ? 'up' : 'down'}
          trendLabel={`${production?.scrapRate ?? 0}% scrap`}
          sparkData={fakeSparkline(qualityRate, 7)}
          delay={75}
        />
        <GradientStatCard
          label="Active Orders"
          value={attention?.activePOs ?? 0}
          variant="orange"
          icon={ClipboardCheck}
          trend={attention?.posBehind ? 'down' : 'up'}
          trendLabel={attention?.posBehind ? `${attention.posBehind} behind` : 'On schedule'}
          sparkData={fakeSparkline(attention?.activePOs ?? 3)}
          delay={150}
        />
        <GradientStatCard
          label="Muda Signals"
          value={attention?.mudaSignals ?? 0}
          variant="purple"
          icon={Eye}
          trend="flat"
          trendLabel="Open observations"
          sparkData={fakeSparkline(attention?.mudaSignals ?? 2)}
          delay={225}
        />
      </div>

      {/* ── OEE Section ─────────────────────────────────────────── */}
      {(oee || !loading) && (
        <GlassCard>
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500
                            flex items-center justify-center shadow-sm shadow-blue-500/20">
              <Gauge className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                OEE — Overall Equipment Effectiveness
              </h3>
              <p className="text-[11px] text-gray-400">Site-level metrics this period</p>
            </div>
          </div>

          {/* OEE Rings — API returns values already as percentages (e.g. 82.3) */}
          {!hasOeeData && (
            <div className="text-center py-8 text-gray-400">
              <Gauge className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No production data yet</p>
              <p className="text-xs mt-1">OEE will populate after production runs are closed</p>
            </div>
          )}
          {hasOeeData && <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-6">
            <div className="flex flex-col items-center gap-2">
              <ProgressRing value={oee.siteOee.availability || 0} size={100} strokeWidth={8} color="#3b82f6">
                <span className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                  {(oee.siteOee.availability || 0).toFixed(1)}%
                </span>
              </ProgressRing>
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Availability</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <ProgressRing value={oee.siteOee.performance || 0} size={100} strokeWidth={8} color="#10b981">
                <span className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                  {(oee.siteOee.performance || 0).toFixed(1)}%
                </span>
              </ProgressRing>
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Performance</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <ProgressRing value={oee.siteOee.quality || 0} size={100} strokeWidth={8} color="#8b5cf6">
                <span className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                  {(oee.siteOee.quality || 0).toFixed(1)}%
                </span>
              </ProgressRing>
              <span className="text-xs font-medium text-purple-600 dark:text-purple-400">Quality</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <ProgressRing value={oee.siteOee.oee || 0} size={100} strokeWidth={8} color="#f59e0b">
                <span className="text-lg font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent tabular-nums">
                  {(oee.siteOee.oee || 0).toFixed(1)}%
                </span>
              </ProgressRing>
              <span className="text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">Overall OEE</span>
            </div>
          </div>}

          {/* Workstation Breakdown Table */}
          {hasOeeData && oee.workstations && oee.workstations.length > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
                Per Workstation
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400">
                      <th className="pb-2 font-medium">Workstation</th>
                      <th className="pb-2 font-medium text-right">Availability</th>
                      <th className="pb-2 font-medium text-right">Performance</th>
                      <th className="pb-2 font-medium text-right">Quality</th>
                      <th className="pb-2 font-medium text-right">OEE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                    {oee.workstations.map((ws) => (
                      <tr key={ws.workstationId} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20">
                        <td className="py-2 font-medium text-gray-700 dark:text-gray-200">{ws.workstationName}</td>
                        <td className="py-2 text-right text-gray-600 dark:text-gray-300 tabular-nums">{(ws.availability || 0).toFixed(1)}%</td>
                        <td className="py-2 text-right text-gray-600 dark:text-gray-300 tabular-nums">{(ws.performance || 0).toFixed(1)}%</td>
                        <td className="py-2 text-right text-gray-600 dark:text-gray-300 tabular-nums">{(ws.quality || 0).toFixed(1)}%</td>
                        <td className="py-2 text-right font-semibold text-gray-800 dark:text-white tabular-nums">{(ws.oee || 0).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </GlassCard>
      )}

      {/* ── Charts Row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Production Trend (2 cols) */}
        <GlassCard className="xl:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600
                              flex items-center justify-center shadow-sm shadow-blue-500/20">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  Production Trend
                </h3>
                <p className="text-[11px] text-gray-400">Units produced & scrap this week</p>
              </div>
            </div>
            <Link href="/dashboard/oee"
              className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View OEE <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <TrendChart
            data={WEEK_TREND}
            color1="#3b82f6"
            color2="#ef4444"
            label1="Produced"
            label2="Scrap"
            height={240}
          />
        </GlassCard>

        {/* Quality Donut (1 col) */}
        <GlassCard>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-500
                            flex items-center justify-center shadow-sm shadow-emerald-500/20">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Quality Overview
              </h3>
              <p className="text-[11px] text-gray-400">Good vs scrap this week</p>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <DonutChart data={donutData} size={180} innerRadius={60} outerRadius={80}>
              <p className="text-2xl font-extrabold text-gray-900 dark:text-white tabular-nums">
                {qualityRate.toFixed(1)}%
              </p>
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Pass Rate</p>
            </DonutChart>

            <div className="flex items-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-xs text-gray-500">Good ({Math.max(0, produced - scrap)})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-xs text-gray-500">Scrap ({scrap})</span>
              </div>
            </div>
          </div>

          {/* Workstation status */}
          <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-gray-500">{attention?.totalWorkstations ?? 0} workstations</span>
            </div>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
              {Math.max(0, (attention?.totalWorkstations ?? 0) - (attention?.machinesDown ?? 0))} online
            </span>
          </div>
        </GlassCard>
      </div>

      {/* ── Losses + Muda Row ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Losses Bar Chart */}
        <GlassCard>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500
                              flex items-center justify-center shadow-sm shadow-orange-500/20">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  Loss Analysis
                </h3>
                <p className="text-[11px] text-gray-400">{losses?.totalHours?.toFixed(1) ?? 0}h total downtime</p>
              </div>
            </div>
          </div>
          {lossBarData.length > 0 ? (
            <HBarChart data={lossBarData} height={220} />
          ) : (
            <div className="flex items-center justify-center h-52 text-sm text-gray-400">
              No losses recorded this week
            </div>
          )}
        </GlassCard>

        {/* Muda Signals */}
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500
                              flex items-center justify-center shadow-sm shadow-amber-500/20">
                <CircleAlert className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  Open Muda Signals
                </h3>
                <p className="text-[11px] text-gray-400">{mudaSignals.length} observation{mudaSignals.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <Link href="/gemba"
              className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View All <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {mudaSignals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                <ShieldCheck className="w-6 h-6 text-emerald-500" />
              </div>
              <p className="text-sm font-medium text-gray-600">All clear</p>
              <p className="text-xs text-gray-400 mt-0.5">No open observations</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {mudaSignals.slice(0, 8).map((obs) => (
                <div key={obs.id}
                  className="flex items-start gap-3 p-3 rounded-xl bg-gray-50/80 dark:bg-gray-700/30
                             hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors group cursor-pointer">
                  <span className={`mt-0.5 px-2 py-0.5 text-[10px] font-bold uppercase rounded-full
                                    ${SEVERITY_BADGE[obs.severity] || SEVERITY_BADGE.medium}`}>
                    {obs.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-white leading-snug line-clamp-1">
                      {obs.description}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {WASTE_LABELS[obs.wasteCategory] || obs.wasteCategory}
                      <span className="mx-1">·</span>{obs.status}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors mt-0.5" />
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      {/* ── Quick Actions ───────────────────────────────────────── */}
      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Gemba Walk', href: '/gemba', icon: Eye, gradient: 'from-blue-600 to-indigo-600', shadow: 'shadow-blue-500/20' },
            { label: '5S Audit', href: '/tools/five-s', icon: ClipboardCheck, gradient: 'from-orange-500 to-amber-500', shadow: 'shadow-orange-500/20' },
            { label: 'Kaizen Idea', href: '/tools/kaizen', icon: Lightbulb, gradient: 'from-violet-600 to-purple-500', shadow: 'shadow-violet-500/20' },
            { label: 'Quality', href: '/quality', icon: ShieldCheck, gradient: 'from-emerald-600 to-teal-500', shadow: 'shadow-emerald-500/20' },
          ].map(({ label, href, icon: Icon, gradient, shadow }) => (
            <Link key={href} href={href}
              className="group flex items-center gap-3 p-4
                bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl
                border border-gray-100 dark:border-gray-700/50
                shadow-sm hover:shadow-lg hover:-translate-y-0.5
                transition-all duration-200">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient}
                flex items-center justify-center shadow-md ${shadow}
                group-hover:scale-110 transition-transform duration-200`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{label}</span>
              <ArrowRight className="w-4 h-4 text-gray-300 ml-auto group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
