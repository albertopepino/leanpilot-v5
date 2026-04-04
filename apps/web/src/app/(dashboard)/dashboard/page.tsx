'use client';

import { useEffect, useState } from 'react';
import { api, auth } from '@/lib/api';
import {
  AlertTriangle, Wrench, Pause, Clock, CalendarOff, ShieldAlert,
  Activity, Eye, PackageX, Boxes, CircleAlert, Gauge, ShieldCheck,
  ClipboardCheck, Lightbulb, ChevronRight, ArrowUpRight, Factory,
  ArrowRight, Zap, Settings2, ChevronUp, ChevronDown, Check,
} from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientStatCard } from '@/components/ui/GradientStatCard';
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
  { key: 'breakdown' as const,    label: 'Breakdown',    color: '#ef4444', barColor: 'bg-red-500' },
  { key: 'changeover' as const,   label: 'Changeover',   color: '#eab308', barColor: 'bg-yellow-500' },
  { key: 'idle' as const,         label: 'Idle',          color: '#64748b', barColor: 'bg-slate-500' },
  { key: 'maintenance' as const,  label: 'Maintenance',   color: '#3b82f6', barColor: 'bg-blue-500' },
  { key: 'quality_hold' as const, label: 'Quality Hold',  color: '#a855f7', barColor: 'bg-purple-500' },
  { key: 'planned_stop' as const, label: 'Planned Stop',  color: '#f97316', barColor: 'bg-orange-500' },
];

const SEVERITY_BADGE: Record<string, string> = {
  high:   'bg-red-50 text-red-600 ring-1 ring-red-200/60 dark:bg-red-900/30 dark:text-red-400 dark:ring-red-700/50',
  medium: 'bg-amber-50 text-amber-600 ring-1 ring-amber-200/60 dark:bg-amber-900/30 dark:text-amber-400 dark:ring-amber-700/50',
  low:    'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-700/50',
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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function getShift(): string {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) return 'Morning Shift';
  if (hour >= 14 && hour < 22) return 'Afternoon Shift';
  return 'Night Shift';
}

// ── Skeleton with shimmer ─────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .skeleton-shimmer {
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%);
          background-size: 200% 100%;
          animation: shimmer 1.5s ease-in-out infinite;
        }
      `}</style>
      <div className="px-6 py-6 max-w-[1600px] mx-auto space-y-6">
        <div className="relative h-40 bg-gray-200 dark:bg-gray-800 rounded-2xl overflow-hidden">
          <div className="absolute inset-0 skeleton-shimmer" />
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="relative h-36 rounded-2xl bg-gray-200 dark:bg-gray-800 overflow-hidden">
              <div className="absolute inset-0 skeleton-shimmer" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 relative h-72 rounded-2xl bg-gray-200 dark:bg-gray-800 overflow-hidden">
            <div className="absolute inset-0 skeleton-shimmer" />
          </div>
          <div className="relative h-72 rounded-2xl bg-gray-200 dark:bg-gray-800 overflow-hidden">
            <div className="absolute inset-0 skeleton-shimmer" />
          </div>
        </div>
      </div>
    </>
  );
}

// ── Animated Loss Bar ─────────────────────────────────────────────────

function LossBar({ label, hours, maxHours, color, barColor, index }: {
  label: string; hours: number; maxHours: number; color: string; barColor: string; index: number;
}) {
  const pct = maxHours > 0 ? (hours / maxHours) * 100 : 0;
  return (
    <div
      className="opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]"
      style={{ animationDelay: `${0.3 + index * 0.08}s` }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
        <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">{hours.toFixed(1)}h</span>
      </div>
      <div className="h-3 rounded-full bg-gray-100 dark:bg-gray-700/50 overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} opacity-0 animate-[growBar_0.8s_ease-out_forwards]`}
          style={{
            width: `${pct}%`,
            animationDelay: `${0.5 + index * 0.1}s`,
          }}
        />
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────

// ── Dashboard Widget Config ────────────────────────────────────────────

interface WidgetConfig {
  id: string;
  visible: boolean;
}

const DASHBOARD_WIDGETS = [
  { id: 'kpis', label: 'KPI Cards', defaultVisible: true },
  { id: 'oee', label: 'OEE Overview', defaultVisible: true },
  { id: 'charts', label: 'Production Trend & Quality', defaultVisible: true },
  { id: 'losses', label: 'Loss Breakdown', defaultVisible: true },
  { id: 'muda', label: 'Muda Signals', defaultVisible: true },
  { id: 'actions', label: 'Quick Actions', defaultVisible: true },
];

const DEFAULT_LAYOUT: WidgetConfig[] = DASHBOARD_WIDGETS.map(w => ({
  id: w.id,
  visible: w.defaultVisible,
}));

export default function DashboardPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [mudaSignals, setMudaSignals] = useState<MudaSignal[]>([]);
  const [oee, setOee] = useState<OeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [customizeMode, setCustomizeMode] = useState(false);
  const [widgetLayout, setWidgetLayout] = useState<WidgetConfig[]>(DEFAULT_LAYOUT);
  const user = auth.getUser();

  // Load saved layout + dashboard data
  useEffect(() => {
    Promise.all([
      api.get<DashboardOverview>('/dashboard/overview').catch(() => null),
      api.get<any>('/gemba/muda-signals').catch(() => []),
      api.get<OeeData>('/dashboard/oee').catch(() => null),
      api.get<{ layout: WidgetConfig[] | null }>('/dashboard/layout').catch(() => ({ layout: null })),
    ]).then(([overview, signals, oeeData, layoutRes]) => {
      setData(overview);
      setMudaSignals(Array.isArray(signals) ? signals : []);
      setOee(oeeData);
      if (layoutRes?.layout && Array.isArray(layoutRes.layout)) {
        // Merge saved layout with defaults (in case new widgets were added)
        const savedIds = new Set(layoutRes.layout.map((w: WidgetConfig) => w.id));
        const merged = [
          ...layoutRes.layout,
          ...DEFAULT_LAYOUT.filter(w => !savedIds.has(w.id)),
        ];
        setWidgetLayout(merged);
      }
    }).finally(() => setLoading(false));
  }, []);

  const saveLayout = (layout: WidgetConfig[]) => {
    setWidgetLayout(layout);
    api.patch('/dashboard/layout', { layout }).catch(() => {});
  };

  const toggleWidget = (id: string) => {
    const updated = widgetLayout.map(w =>
      w.id === id ? { ...w, visible: !w.visible } : w,
    );
    saveLayout(updated);
  };

  const moveWidget = (id: string, direction: 'up' | 'down') => {
    const idx = widgetLayout.findIndex(w => w.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= widgetLayout.length) return;
    const updated = [...widgetLayout];
    [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
    saveLayout(updated);
  };

  const isWidgetVisible = (id: string) => {
    const w = widgetLayout.find(w => w.id === id);
    return w ? w.visible : true;
  };

  if (loading) return <DashboardSkeleton />;

  const losses = data?.losses;
  const production = data?.production;
  const attention = data?.attention;

  const qualityRate = production && typeof production.scrapRate === 'number' ? Math.max(0, 100 - production.scrapRate) : 0;
  const hasOeeData = oee?.siteOee && (oee.siteOee.availability > 0 || oee.siteOee.performance > 0 || oee.siteOee.quality > 0);

  // Loss data for animated bars
  const lossBarData = LOSS_CONFIG
    .map(l => ({ ...l, hours: (losses?.[l.key] as number) ?? 0 }))
    .filter(l => l.hours > 0)
    .sort((a, b) => b.hours - a.hours);
  const maxLossHours = lossBarData.length > 0 ? lossBarData[0].hours : 1;

  // Donut data for production split
  const produced = production?.totalProduced ?? 0;
  const scrap = production?.totalScrap ?? 0;
  const donutData = [
    { name: 'Good', value: Math.max(0, produced - scrap), color: '#10b981' },
    { name: 'Scrap', value: scrap, color: '#ef4444' },
  ];

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes countUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes growBar {
          from { width: 0; opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 8px rgba(239, 68, 68, 0.4); }
          50% { box-shadow: 0 0 20px rgba(239, 68, 68, 0.7); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div className="px-6 py-6 max-w-[1600px] mx-auto space-y-6 relative">
        {/* Subtle background decoration */}
        <div className="fixed -right-20 -top-20 w-80 h-80 rounded-full bg-blue-500/5 blur-3xl pointer-events-none" />
        <div className="fixed -left-40 top-1/2 w-96 h-96 rounded-full bg-violet-500/5 blur-3xl pointer-events-none" />

        {/* ── Hero Section ───────────────────────────────────────── */}
        <div
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600
                     p-8 text-white shadow-xl shadow-blue-500/20
                     opacity-0 animate-[scaleIn_0.6s_ease-out_forwards]"
        >
          {/* Background patterns */}
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />
          <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-violet-400/10 rounded-full blur-3xl translate-y-1/2" />

          <div className="relative z-10 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1">
                  <Factory className="w-4 h-4 text-blue-200" />
                  <span className="text-sm font-medium text-blue-100">{user?.siteName || 'LeanPilot'}</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1">
                  <Clock className="w-3.5 h-3.5 text-blue-200" />
                  <span className="text-xs font-medium text-blue-200">{getShift()}</span>
                </div>
              </div>
              <h1 className="text-3xl font-black mt-4 tracking-tight">
                {getGreeting()}, {user?.firstName || 'User'}
              </h1>
              <p className="text-blue-200 text-sm mt-1.5 font-medium">{formatDate()}</p>

              {/* Status pills */}
              <div className="mt-4 flex flex-wrap gap-2">
                {attention?.machinesDown ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-red-500/30 backdrop-blur-sm rounded-full px-3 py-1.5 text-red-100">
                    <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                    {attention.machinesDown} machine{attention.machinesDown > 1 ? 's' : ''} down
                  </span>
                ) : null}
                {attention?.posBehind ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-amber-500/25 backdrop-blur-sm rounded-full px-3 py-1.5 text-amber-100">
                    {attention.posBehind} PO{attention.posBehind > 1 ? 's' : ''} behind
                  </span>
                ) : null}
                {attention?.mudaSignals ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-violet-500/25 backdrop-blur-sm rounded-full px-3 py-1.5 text-violet-100">
                    {attention.mudaSignals} open muda signal{attention.mudaSignals !== 1 ? 's' : ''}
                  </span>
                ) : null}
                {!attention?.machinesDown && !attention?.posBehind && !attention?.mudaSignals && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-500/25 backdrop-blur-sm rounded-full px-3 py-1.5 text-emerald-100">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    All systems running smoothly
                  </span>
                )}
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={() => setCustomizeMode(!customizeMode)}
                className={`flex items-center gap-2 backdrop-blur-sm
                           rounded-xl px-4 py-3 text-sm font-semibold text-white
                           transition-all duration-200 hover:scale-105
                           shadow-lg shadow-black/10 ${
                             customizeMode ? 'bg-white/30' : 'bg-white/15 hover:bg-white/25'
                           }`}
              >
                <Settings2 className="w-4 h-4" />
                {customizeMode ? 'Done' : 'Customize'}
              </button>
              <Link
                href="/gemba"
                className="flex items-center gap-2 bg-white/15 backdrop-blur-sm
                           rounded-xl px-5 py-3 text-sm font-semibold text-white
                           hover:bg-white/25 transition-all duration-200 hover:scale-105
                           shadow-lg shadow-black/10"
              >
                Start Gemba Walk
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* ── Attention Alerts (machines down / POs behind) ────── */}
        {attention && (attention.machinesDown > 0 || attention.posBehind > 0) && (
          <div className="flex flex-wrap gap-3 opacity-0 animate-[fadeIn_0.5s_ease-out_0.15s_forwards]">
            {attention.machinesDown > 0 && (
              <Link href="/shopfloor" className="flex items-center gap-2.5 rounded-2xl px-5 py-3 text-sm
                border border-red-300/50 dark:border-red-800/50
                bg-red-50/80 dark:bg-red-900/20 backdrop-blur-sm
                hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group"
                style={{ animation: 'pulseGlow 2s ease-in-out infinite' }}
              >
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                </span>
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="font-bold text-red-700 dark:text-red-400">
                  {attention.machinesDown} machine{attention.machinesDown > 1 ? 's' : ''} down
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-red-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
            )}
            {attention.posBehind > 0 && (
              <Link href="/shopfloor" className="flex items-center gap-2.5 rounded-2xl px-5 py-3 text-sm
                border border-orange-300/50 dark:border-orange-800/50
                bg-orange-50/80 dark:bg-orange-900/20 backdrop-blur-sm
                hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group">
                <PackageX className="w-4 h-4 text-orange-500" />
                <span className="font-bold text-orange-700 dark:text-orange-400">
                  {attention.posBehind} PO{attention.posBehind > 1 ? 's' : ''} behind schedule
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-orange-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
            )}
          </div>
        )}

        {/* ── Customize Panel ──────────────────────────────────── */}
        {customizeMode && (
          <div className="opacity-0 animate-[fadeIn_0.3s_ease-out_forwards]">
            <GlassCard>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-600 to-gray-700
                                flex items-center justify-center shadow-sm">
                  <Settings2 className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    Customize Dashboard
                  </h3>
                  <p className="text-[11px] text-gray-400">Toggle visibility and reorder widgets</p>
                </div>
              </div>
              <div className="space-y-2">
                {widgetLayout.map((w, idx) => {
                  const def = DASHBOARD_WIDGETS.find(d => d.id === w.id);
                  if (!def) return null;
                  return (
                    <div
                      key={w.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700/50"
                    >
                      <button
                        onClick={() => toggleWidget(w.id)}
                        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                          w.visible
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {w.visible && <Check className="w-3.5 h-3.5" />}
                      </button>
                      <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                        {def.label}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveWidget(w.id, 'up')}
                          disabled={idx === 0}
                          className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 transition-colors"
                        >
                          <ChevronUp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        </button>
                        <button
                          onClick={() => moveWidget(w.id, 'down')}
                          disabled={idx === widgetLayout.length - 1}
                          className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 transition-colors"
                        >
                          <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          </div>
        )}

        {/* ── Widgets (rendered in saved order) ───────────────── */}
        {widgetLayout.map(w => {
          if (!w.visible) return null;

          switch (w.id) {
            case 'kpis':
              return (
                <div key="kpis" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {[
            {
              label: 'Total Produced', value: produced, variant: 'blue' as const,
              icon: Boxes, trend: 'up' as const, trendLabel: 'vs. last week',
              sparkData: fakeSparkline(produced / 7),
            },
            {
              label: 'Quality Rate', value: qualityRate, suffix: '%', decimals: 1,
              variant: 'green' as const, icon: ShieldCheck,
              trend: (qualityRate >= 98 ? 'up' : 'down') as 'up' | 'down',
              trendLabel: `${production?.scrapRate ?? 0}% scrap`,
              sparkData: fakeSparkline(qualityRate, 7),
            },
            {
              label: 'Active Orders', value: attention?.activePOs ?? 0,
              variant: 'orange' as const, icon: ClipboardCheck,
              trend: (attention?.posBehind ? 'down' : 'up') as 'up' | 'down',
              trendLabel: attention?.posBehind ? `${attention.posBehind} behind` : 'On schedule',
              sparkData: fakeSparkline(attention?.activePOs ?? 3),
            },
            {
              label: 'Muda Signals', value: attention?.mudaSignals ?? 0,
              variant: 'purple' as const, icon: Eye,
              trend: 'flat' as const, trendLabel: 'Open observations',
              sparkData: fakeSparkline(attention?.mudaSignals ?? 2),
            },
          ].map((card, i) => (
            <div
              key={card.label}
              className="opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]"
              style={{ animationDelay: `${0.2 + i * 0.06}s` }}
            >
              <GradientStatCard
                label={card.label}
                value={card.value}
                suffix={card.suffix}
                decimals={card.decimals}
                variant={card.variant}
                icon={card.icon}
                trend={card.trend}
                trendLabel={card.trendLabel}
                sparkData={card.sparkData}
                delay={200 + i * 60}
              />
            </div>
          ))}
        </div>
              );

            case 'oee':
              return (
        <div key="oee">
        {(oee || !loading) && (
          <div className="opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]" style={{ animationDelay: '0.45s' }}>
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

              {!hasOeeData && (
                <div className="text-center py-8 text-gray-400">
                  <Gauge className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">No production data yet</p>
                  <p className="text-xs mt-1">OEE will populate after production runs are closed</p>
                </div>
              )}
              {hasOeeData && oee && <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-6">
                {[
                  { val: oee.siteOee.availability, label: 'Availability', color: '#3b82f6', labelClass: 'text-blue-600 dark:text-blue-400' },
                  { val: oee.siteOee.performance, label: 'Performance', color: '#10b981', labelClass: 'text-emerald-600 dark:text-emerald-400' },
                  { val: oee.siteOee.quality, label: 'Quality', color: '#8b5cf6', labelClass: 'text-purple-600 dark:text-purple-400' },
                  { val: oee.siteOee.oee, label: 'Overall OEE', color: '#f59e0b', labelClass: '' },
                ].map((ring, i) => (
                  <div
                    key={ring.label}
                    className="flex flex-col items-center gap-2 opacity-0 animate-[scaleIn_0.5s_ease-out_forwards]"
                    style={{ animationDelay: `${0.6 + i * 0.1}s` }}
                  >
                    <ProgressRing value={ring.val || 0} size={100} strokeWidth={8} color={ring.color}>
                      <span className={`text-lg font-bold tabular-nums ${
                        ring.label === 'Overall OEE'
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent'
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {(ring.val || 0).toFixed(1)}%
                      </span>
                    </ProgressRing>
                    <span className={`text-xs font-medium ${
                      ring.label === 'Overall OEE'
                        ? 'font-semibold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent'
                        : ring.labelClass
                    }`}>
                      {ring.label}
                    </span>
                  </div>
                ))}
              </div>}

              {/* Workstation Breakdown Table */}
              {hasOeeData && oee && oee.workstations && oee.workstations.length > 0 && (
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
                        {oee.workstations.map((ws, i) => (
                          <tr
                            key={ws.workstationId}
                            className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 opacity-0 animate-[fadeIn_0.4s_ease-out_forwards]"
                            style={{ animationDelay: `${0.8 + i * 0.05}s` }}
                          >
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
          </div>
        )}
        </div>
              );

            case 'charts':
              return (
        <div key="charts" className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* Production Trend (2 cols) */}
          <div
            className="xl:col-span-2 opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]"
            style={{ animationDelay: '0.5s' }}
          >
            <GlassCard>
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
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1
                             hover:gap-2 transition-all duration-200">
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
          </div>

          {/* Quality Donut (1 col) */}
          <div
            className="opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]"
            style={{ animationDelay: '0.56s' }}
          >
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
                  <p className="text-3xl font-black text-gray-900 dark:text-white tabular-nums">
                    {qualityRate.toFixed(1)}%
                  </p>
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Pass Rate</p>
                </DonutChart>

                <div className="flex items-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">Good ({Math.max(0, produced - scrap)})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">Scrap ({scrap})</span>
                  </div>
                </div>
              </div>

              {/* Workstation status */}
              <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{attention?.totalWorkstations ?? 0} workstations</span>
                </div>
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300 tabular-nums">
                  {Math.max(0, (attention?.totalWorkstations ?? 0) - (attention?.machinesDown ?? 0))} online
                </span>
              </div>
            </GlassCard>
          </div>
        </div>
              );

            case 'losses':
              return (
        <div key="losses" className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Losses — Animated Bar Chart */}
          <div
            className="opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]"
            style={{ animationDelay: '0.62s' }}
          >
            <GlassCard>
              <div className="flex items-center justify-between mb-5">
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
                {losses?.totalHours ? (
                  <span className="text-2xl font-black tabular-nums text-gray-900 dark:text-white">
                    {losses.totalHours.toFixed(1)}<span className="text-sm font-semibold text-gray-400 ml-0.5">h</span>
                  </span>
                ) : null}
              </div>
              {lossBarData.length > 0 ? (
                <div className="space-y-4">
                  {lossBarData.map((loss, i) => (
                    <LossBar
                      key={loss.key}
                      label={loss.label}
                      hours={loss.hours}
                      maxHours={maxLossHours}
                      color={loss.color}
                      barColor={loss.barColor}
                      index={i}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-52 text-gray-400">
                  <ShieldCheck className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-sm font-medium">No losses recorded</p>
                  <p className="text-xs mt-0.5">Great work keeping the line running</p>
                </div>
              )}
            </GlassCard>
          </div>

          {/* Muda Signals (paired in grid if both visible) */}
          {isWidgetVisible('muda') && (
          <div
            className="opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]"
            style={{ animationDelay: '0.68s' }}
          >
            <GlassCard>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500
                                    flex items-center justify-center shadow-sm shadow-amber-500/20">
                      <CircleAlert className="w-4 h-4 text-white" />
                    </div>
                    {mudaSignals.length > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 text-white
                                       text-[10px] font-bold flex items-center justify-center
                                       animate-bounce shadow-lg shadow-amber-500/30">
                        {mudaSignals.length}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                      Open Muda Signals
                    </h3>
                    <p className="text-[11px] text-gray-400">{mudaSignals.length} observation{mudaSignals.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <Link href="/gemba"
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1
                             hover:gap-2 transition-all duration-200">
                  View All <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {mudaSignals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-3">
                    <ShieldCheck className="w-6 h-6 text-emerald-500" />
                  </div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">All clear</p>
                  <p className="text-xs text-gray-400 mt-0.5">No open observations</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {mudaSignals.slice(0, 8).map((obs, i) => (
                    <div key={obs.id}
                      className="flex items-start gap-3 p-3 rounded-2xl
                                 bg-gray-50/80 dark:bg-gray-700/30 backdrop-blur-sm
                                 hover:bg-gray-100 dark:hover:bg-gray-700/50
                                 hover:shadow-md hover:-translate-y-0.5
                                 transition-all duration-300 group cursor-pointer
                                 opacity-0 animate-[slideInRight_0.4s_ease-out_forwards]"
                      style={{ animationDelay: `${0.8 + i * 0.06}s` }}
                    >
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
                          <span className="mx-1">&middot;</span>{obs.status}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all duration-200 mt-0.5" />
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>
          )}
        </div>
              );

            case 'muda':
              // Muda is rendered inside 'losses' grid when both are visible; standalone otherwise
              if (isWidgetVisible('losses')) return null;
              return (
        <div key="muda" className="opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]" style={{ animationDelay: '0.68s' }}>
          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500
                                  flex items-center justify-center shadow-sm shadow-amber-500/20">
                    <CircleAlert className="w-4 h-4 text-white" />
                  </div>
                  {mudaSignals.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 text-white
                                     text-[10px] font-bold flex items-center justify-center
                                     animate-bounce shadow-lg shadow-amber-500/30">
                      {mudaSignals.length}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    Open Muda Signals
                  </h3>
                  <p className="text-[11px] text-gray-400">{mudaSignals.length} observation{mudaSignals.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <Link href="/gemba"
                className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1
                           hover:gap-2 transition-all duration-200">
                View All <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            {mudaSignals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-3">
                  <ShieldCheck className="w-6 h-6 text-emerald-500" />
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">All clear</p>
                <p className="text-xs text-gray-400 mt-0.5">No open observations</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {mudaSignals.slice(0, 8).map((obs, i) => (
                  <div key={obs.id}
                    className="flex items-start gap-3 p-3 rounded-2xl
                               bg-gray-50/80 dark:bg-gray-700/30 backdrop-blur-sm
                               hover:bg-gray-100 dark:hover:bg-gray-700/50
                               hover:shadow-md hover:-translate-y-0.5
                               transition-all duration-300 group cursor-pointer
                               opacity-0 animate-[slideInRight_0.4s_ease-out_forwards]"
                    style={{ animationDelay: `${0.8 + i * 0.06}s` }}
                  >
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
                        <span className="mx-1">&middot;</span>{obs.status}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all duration-200 mt-0.5" />
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
              );

            case 'actions':
              return (
        <div key="actions" className="opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]" style={{ animationDelay: '0.75s' }}>
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Gemba Walk', href: '/gemba', icon: Eye, gradient: 'from-blue-600 to-indigo-600', shadow: 'shadow-blue-500/20' },
              { label: '5S Audit', href: '/tools/five-s', icon: ClipboardCheck, gradient: 'from-orange-500 to-amber-500', shadow: 'shadow-orange-500/20' },
              { label: 'Kaizen Idea', href: '/tools/kaizen', icon: Lightbulb, gradient: 'from-violet-600 to-purple-500', shadow: 'shadow-violet-500/20' },
              { label: 'Quality', href: '/quality', icon: ShieldCheck, gradient: 'from-emerald-600 to-teal-500', shadow: 'shadow-emerald-500/20' },
            ].map(({ label, href, icon: Icon, gradient, shadow }, i) => (
              <Link key={href} href={href}
                className="group flex items-center gap-3 p-4
                  backdrop-blur-sm bg-white/80 dark:bg-gray-800/50
                  rounded-2xl border border-gray-100 dark:border-gray-700/50
                  shadow-sm hover:shadow-lg hover:-translate-y-0.5
                  transition-all duration-300
                  opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]"
                style={{ animationDelay: `${0.8 + i * 0.06}s` }}
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient}
                  flex items-center justify-center shadow-md ${shadow}
                  group-hover:scale-110 transition-transform duration-200`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{label}</span>
                <ArrowRight className="w-4 h-4 text-gray-300 ml-auto group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all duration-200" />
              </Link>
            ))}
          </div>
        </div>
              );

            default:
              return null;
          }
        })}
      </div>
    </>
  );
}
