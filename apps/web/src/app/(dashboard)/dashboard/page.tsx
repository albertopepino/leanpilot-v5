'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Boxes,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  Clock3,
  Eye,
  Factory,
  Gauge,
  Lightbulb,
  PackageX,
  Settings2,
  ShieldCheck,
  Siren,
  Wrench,
} from 'lucide-react';
import { api, auth } from '@/lib/api';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { GradientStatCard } from '@/components/ui/GradientStatCard';
import { MetricCard } from '@/components/ui/MetricCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { DonutChart, HBarChart, ProgressRing } from '@/components/ui/charts';

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
}

interface WidgetConfig {
  id: string;
  visible: boolean;
}

const DASHBOARD_WIDGETS = [
  { id: 'kpis', label: 'KPI Cards', defaultVisible: true },
  { id: 'oee', label: 'OEE Overview', defaultVisible: true },
  { id: 'charts', label: 'Production Mix', defaultVisible: true },
  { id: 'losses', label: 'Loss Analysis', defaultVisible: true },
  { id: 'muda', label: 'Muda Signals', defaultVisible: true },
  { id: 'actions', label: 'Quick Actions', defaultVisible: true },
];

const DEFAULT_LAYOUT: WidgetConfig[] = DASHBOARD_WIDGETS.map((w) => ({
  id: w.id,
  visible: w.defaultVisible,
}));

const LOSS_CONFIG = [
  { key: 'breakdown' as const, label: 'Breakdown', color: '#ef4444', tone: 'bg-red-500' },
  { key: 'changeover' as const, label: 'Changeover', color: '#f59e0b', tone: 'bg-amber-500' },
  { key: 'idle' as const, label: 'Idle', color: '#64748b', tone: 'bg-slate-500' },
  { key: 'maintenance' as const, label: 'Maintenance', color: '#2563eb', tone: 'bg-blue-600' },
  { key: 'quality_hold' as const, label: 'Quality Hold', color: '#0891b2', tone: 'bg-cyan-600' },
  { key: 'planned_stop' as const, label: 'Planned Stop', color: '#f97316', tone: 'bg-orange-500' },
];

const WASTE_LABELS: Record<string, string> = {
  waiting: 'Waiting',
  overproduction: 'Overproduction',
  inventory: 'Inventory',
  motion: 'Motion',
  transportation: 'Transportation',
  over_processing: 'Over-processing',
  defect: 'Defects',
  talent: 'Unused Talent',
};

const SEVERITY_CLASS: Record<string, string> = {
  high: 'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900',
  medium: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
  low: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
};

function getGreetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'goodMorning';
  if (hour < 17) return 'goodAfternoon';
  return 'goodEvening';
}

function getShiftKey(): string {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) return 'morning';
  if (hour >= 14 && hour < 22) return 'afternoon';
  return 'night';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function DashboardSkeleton() {
  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto space-y-6">
      <div className="brand-panel h-56 skeleton-shimmer rounded-[1.4rem]" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="h-36 rounded-[1.25rem] skeleton-shimmer" />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-5">
        <div className="h-[27rem] rounded-[1.25rem] skeleton-shimmer" />
        <div className="h-[27rem] rounded-[1.25rem] skeleton-shimmer" />
      </div>
    </div>
  );
}

function SectionCard({
  eyebrow,
  title,
  description,
  action,
  children,
  className = '',
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`relative overflow-hidden ${className}`}>
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(37,99,235,0.35),transparent)]" />
      <CardHeader className="mb-5">
        <div>
          <p className="text-section-title mb-1">{eyebrow}</p>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {action}
      </CardHeader>
      {children}
    </Card>
  );
}

function LossBar({
  label,
  value,
  maxValue,
  tone,
}: {
  label: string;
  value: number;
  maxValue: number;
  tone: string;
}) {
  const width = maxValue > 0 ? Math.max(6, (value / maxValue) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-[var(--text)]">{label}</span>
        <span className="font-semibold tabular-nums text-[var(--text-strong)]">{value.toFixed(1)}h</span>
      </div>
      <div className="h-2.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
        <div
          className={`h-full rounded-full ${tone}`}
          style={{ width: `${width}%`, transition: 'width 600ms ease' }}
        />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const user = auth.getUser();
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [oee, setOee] = useState<OeeData | null>(null);
  const [mudaSignals, setMudaSignals] = useState<MudaSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [customizeMode, setCustomizeMode] = useState(false);
  const [widgetLayout, setWidgetLayout] = useState<WidgetConfig[]>(DEFAULT_LAYOUT);

  useEffect(() => {
    Promise.all([
      api.get<DashboardOverview>('/dashboard/overview').catch(() => null),
      api.get<OeeData>('/dashboard/oee').catch(() => null),
      api.get<MudaSignal[]>('/gemba/muda-signals').catch(() => []),
      api.get<{ layout: WidgetConfig[] | null }>('/dashboard/layout').catch(() => ({ layout: null })),
    ])
      .then(([overview, oeeData, signals, layoutRes]) => {
        setData(overview);
        setOee(oeeData);
        setMudaSignals(Array.isArray(signals) ? signals : []);
        if (layoutRes?.layout && Array.isArray(layoutRes.layout)) {
          const savedIds = new Set(layoutRes.layout.map((w) => w.id));
          setWidgetLayout([
            ...layoutRes.layout,
            ...DEFAULT_LAYOUT.filter((w) => !savedIds.has(w.id)),
          ]);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const saveLayout = (layout: WidgetConfig[]) => {
    setWidgetLayout(layout);
    api.patch('/dashboard/layout', { layout }).catch(() => {});
  };

  const toggleWidget = (id: string) => {
    saveLayout(widgetLayout.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)));
  };

  const moveWidget = (id: string, direction: 'up' | 'down') => {
    const idx = widgetLayout.findIndex((w) => w.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= widgetLayout.length) return;
    const next = [...widgetLayout];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    saveLayout(next);
  };

  if (loading) return <DashboardSkeleton />;

  const production = data?.production;
  const attention = data?.attention;
  const losses = data?.losses;
  const siteOee = oee?.siteOee;
  const qualityRate = production ? Math.max(0, 100 - (production.scrapRate || 0)) : 0;
  const goodUnits = Math.max(0, (production?.totalProduced || 0) - (production?.totalScrap || 0));
  const donutData = [
    { name: 'Good', value: goodUnits, color: '#10b981' },
    { name: 'Scrap', value: production?.totalScrap || 0, color: '#ef4444' },
  ];
  const lossRows = LOSS_CONFIG
    .map((item) => ({ ...item, value: losses?.[item.key] || 0 }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
  const lossMax = lossRows[0]?.value || 1;
  const workstationBars = (oee?.workstations || [])
    .slice()
    .sort((a, b) => b.oee - a.oee)
    .slice(0, 6)
    .map((ws) => ({
      name: ws.workstationName,
      value: Number(ws.oee.toFixed(1)),
      color: ws.oee >= 80 ? '#10b981' : ws.oee >= 60 ? '#f59e0b' : '#ef4444',
    }));
  const visibleWidgetIds = new Set(widgetLayout.filter((w) => w.visible).map((w) => w.id));

  return (
    <div className="px-6 py-6 max-w-[1600px] mx-auto space-y-6">
      <section className="brand-panel relative overflow-hidden px-8 py-8 shadow-[0_24px_80px_rgba(15,23,42,0.2)]">
        <div className="absolute inset-0 opacity-[0.08]" style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }} />
        <div className="absolute -right-24 top-0 h-64 w-64 rounded-full bg-blue-300/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-amber-300/10 blur-3xl" />

        <div className="relative z-10 grid gap-8 xl:grid-cols-[1.25fr_0.75fr]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-[0.16em] text-white/80 uppercase">
                <Factory className="h-3.5 w-3.5" />
                {user?.siteName || 'LeanPilot'}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-[0.16em] text-white/70 uppercase">
                <Clock3 className="h-3.5 w-3.5" />
                {t(getShiftKey())}
              </span>
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-[-0.04em] text-white">
              {t(getGreetingKey())}, {user?.firstName || 'Operator'}.
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-blue-100/80">
              {formatDate()}.
              {' '}This is your operations command surface: throughput, exceptions, quality drift, and the next action that matters.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {(attention?.machinesDown || 0) > 0 && (
                <div className="inline-flex items-center gap-2 rounded-full bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-100 ring-1 ring-red-300/20">
                  <Siren className="h-4 w-4" />
                  {attention?.machinesDown} machine{attention?.machinesDown === 1 ? '' : 's'} down
                </div>
              )}
              {(attention?.posBehind || 0) > 0 && (
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-100 ring-1 ring-amber-300/20">
                  <PackageX className="h-4 w-4" />
                  {attention?.posBehind} order{attention?.posBehind === 1 ? '' : 's'} behind
                </div>
              )}
              {(attention?.mudaSignals || 0) > 0 && (
                <div className="inline-flex items-center gap-2 rounded-full bg-sky-400/20 px-4 py-2 text-sm font-semibold text-sky-100 ring-1 ring-sky-300/20">
                  <Eye className="h-4 w-4" />
                  {attention?.mudaSignals} open muda signal{attention?.mudaSignals === 1 ? '' : 's'}
                </div>
              )}
              {!(attention?.machinesDown || attention?.posBehind || attention?.mudaSignals) && (
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-100 ring-1 ring-emerald-300/20">
                  <Check className="h-4 w-4" />
                  All core systems running
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <Card className="bg-white/10 border-white/10 text-white backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-card-label text-white/60">Site OEE</p>
                  <p className="mt-2 text-[2.5rem] font-black leading-none tracking-[-0.05em]">
                    {siteOee?.oee?.toFixed(1) || '0.0'}%
                  </p>
                  <p className="mt-2 text-sm text-blue-100/75">Availability {siteOee?.availability?.toFixed(1) || '0.0'} · Performance {siteOee?.performance?.toFixed(1) || '0.0'}</p>
                </div>
                <Gauge className="h-11 w-11 text-blue-100/80" />
              </div>
            </Card>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
              <Link href="/shopfloor" className="brand-button flex items-center justify-between px-5 py-4">
                <span className="text-sm font-semibold">Go to Shop Floor</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/gemba" className="flex items-center justify-between rounded-[var(--radius-lg)] border border-white/12 bg-white/10 px-5 py-4 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/15">
                <span>Start Gemba Walk</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => setCustomizeMode((v) => !v)}
                className="flex items-center justify-between rounded-[var(--radius-lg)] border border-white/12 bg-white/5 px-5 py-4 text-sm font-semibold text-white/90 transition hover:bg-white/10 sm:col-span-2"
              >
                <span className="inline-flex items-center gap-2"><Settings2 className="h-4 w-4" /> {customizeMode ? 'Close layout controls' : 'Customize mission board'}</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {customizeMode && (
        <Card>
          <CardHeader>
            <div>
              <p className="text-section-title mb-1">Layout Controls</p>
              <CardTitle>Mission board visibility</CardTitle>
              <CardDescription>Toggle or reorder the dashboard blocks that matter most for this site.</CardDescription>
            </div>
          </CardHeader>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {widgetLayout.map((widget, idx) => {
              const def = DASHBOARD_WIDGETS.find((item) => item.id === widget.id);
              if (!def) return null;
              return (
                <div key={widget.id} className="interactive-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-strong)]">{def.label}</p>
                      <p className="text-caption mt-1">{widget.visible ? 'Visible on dashboard' : 'Hidden from dashboard'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleWidget(widget.id)}
                      className={`h-7 w-12 rounded-full p-1 transition ${widget.visible ? 'bg-blue-600' : 'bg-[var(--surface-2)]'}`}
                    >
                      <span className={`block h-5 w-5 rounded-full bg-white transition ${widget.visible ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <div className="mt-4 flex items-center justify-end gap-1">
                    <button type="button" onClick={() => moveWidget(widget.id, 'up')} disabled={idx === 0} className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-2)] disabled:opacity-30">
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => moveWidget(widget.id, 'down')} disabled={idx === widgetLayout.length - 1} className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-2)] disabled:opacity-30">
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {visibleWidgetIds.has('kpis') && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          <GradientStatCard label="Throughput" value={production?.totalProduced || 0} variant="blue" icon={Boxes} trend={(production?.totalProduced || 0) > 0 ? 'up' : 'flat'} trendLabel="Units completed" />
          <GradientStatCard label="Quality Rate" value={qualityRate} suffix="%" decimals={1} variant="green" icon={ShieldCheck} trend={qualityRate >= 98 ? 'up' : 'down'} trendLabel={`${(production?.scrapRate || 0).toFixed(1)}% scrap`} />
          <MetricCard label="Active Orders" value={attention?.activePOs || 0} variant="production" trend={{ value: -1 * (attention?.posBehind || 0), label: 'late queue pressure' }} />
          <MetricCard label="Open Signals" value={(attention?.machinesDown || 0) + (attention?.mudaSignals || 0)} variant={(attention?.machinesDown || 0) > 0 ? 'danger' : 'warning'} trend={{ value: attention?.machinesDown || 0, label: 'critical interruptions' }} />
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          {visibleWidgetIds.has('oee') && (
            <SectionCard
              eyebrow="Performance"
              title="Equipment effectiveness"
              description="Live site-level OEE with workstation ranking and loss pressure."
              action={<Link href="/dashboard/oee" className="text-sm font-semibold text-blue-600 hover:text-blue-700">Open OEE board</Link>}
            >
              {!siteOee ? (
                <EmptyState icon={Gauge} title="No production history yet" description="Close production runs on the shop floor to populate the OEE board." />
              ) : (
                <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-2">
                    {[
                      { label: 'Availability', value: siteOee.availability, color: '#2563eb' },
                      { label: 'Performance', value: siteOee.performance, color: '#10b981' },
                      { label: 'Quality', value: siteOee.quality, color: '#0891b2' },
                      { label: 'OEE', value: siteOee.oee, color: '#f59e0b' },
                    ].map((ring) => (
                      <div key={ring.label} className="rounded-[1rem] border border-[var(--border-default)] bg-[var(--surface-1)] p-4 text-center">
                        <ProgressRing value={ring.value} size={104} strokeWidth={8} color={ring.color}>
                          <span className="text-sm font-bold tabular-nums text-[var(--text-strong)]">{ring.value.toFixed(1)}%</span>
                        </ProgressRing>
                        <p className="mt-3 text-sm font-semibold text-[var(--text)]">{ring.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-[1rem] border border-[var(--border-default)] bg-[var(--surface-1)] p-4">
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div>
                        <p className="text-card-label">Top Workstations</p>
                        <p className="text-sm text-[var(--text-muted)]">Sorted by best OEE this period</p>
                      </div>
                    </div>
                    {workstationBars.length > 0 ? (
                      <HBarChart data={workstationBars} height={260} />
                    ) : (
                      <EmptyState icon={Wrench} title="No workstation comparison yet" description="Once runs are recorded across stations, they will rank here automatically." />
                    )}
                  </div>
                </div>
              )}
            </SectionCard>
          )}

          {visibleWidgetIds.has('charts') && (
            <SectionCard
              eyebrow="Flow"
              title="Production mix"
              description="Use this view to balance output quality against current station performance."
            >
              <div className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr]">
                <div className="rounded-[1rem] border border-[var(--border-default)] bg-[var(--surface-1)] p-5 text-center">
                  <p className="text-card-label mb-4">Good vs Scrap</p>
                  {(production?.totalProduced || 0) > 0 ? (
                    <>
                      <DonutChart data={donutData} size={220}>
                        <div className="text-center">
                          <p className="text-caption">Good Units</p>
                          <p className="text-2xl font-black tracking-[-0.04em] text-[var(--text-strong)]">{goodUnits}</p>
                        </div>
                      </DonutChart>
                      <div className="mt-5 grid grid-cols-2 gap-3 text-left">
                        <div className="rounded-xl bg-white p-3 ring-1 ring-[var(--border-default)]">
                          <p className="text-caption">Scrap</p>
                          <p className="mt-1 text-lg font-semibold text-[var(--danger)]">{production?.totalScrap || 0}</p>
                        </div>
                        <div className="rounded-xl bg-white p-3 ring-1 ring-[var(--border-default)]">
                          <p className="text-caption">Scrap Rate</p>
                          <p className="mt-1 text-lg font-semibold text-[var(--warning)]">{(production?.scrapRate || 0).toFixed(1)}%</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <EmptyState icon={ClipboardCheck} title="No production mix yet" description="Production output and scrap split will show here after the first completed runs." />
                  )}
                </div>

                <div className="rounded-[1rem] border border-[var(--border-default)] bg-[var(--surface-1)] p-5">
                  <div className="mb-4">
                    <p className="text-card-label">Operational Load</p>
                    <p className="text-sm text-[var(--text-muted)]">Quick context on current site pressure and station count.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <MetricCard label="Workstations" value={attention?.totalWorkstations || 0} />
                    <MetricCard label="Open Muda" value={attention?.mudaSignals || 0} variant={(attention?.mudaSignals || 0) > 0 ? 'warning' : 'default'} />
                    <MetricCard label="Down Assets" value={attention?.machinesDown || 0} variant={(attention?.machinesDown || 0) > 0 ? 'danger' : 'default'} />
                    <MetricCard label="Behind Orders" value={attention?.posBehind || 0} variant={(attention?.posBehind || 0) > 0 ? 'warning' : 'default'} />
                  </div>
                </div>
              </div>
            </SectionCard>
          )}
        </div>

        <div className="space-y-5">
          {visibleWidgetIds.has('losses') && (
            <SectionCard
              eyebrow="Losses"
              title="Downtime structure"
              description="Where time is leaking today, ranked from highest impact downward."
            >
              {lossRows.length === 0 ? (
                <EmptyState icon={Activity} title="No recorded losses yet" description="Loss categories will appear once downtime events and changeovers are recorded." />
              ) : (
                <div className="space-y-4">
                  {lossRows.map((row) => (
                    <LossBar key={row.key} label={row.label} value={row.value} maxValue={lossMax} tone={row.tone} />
                  ))}
                  <div className="rounded-[1rem] border border-dashed border-[var(--border-strong)] bg-[var(--surface-1)] px-4 py-3 text-sm text-[var(--text-muted)]">
                    Total loss time this period: <span className="font-semibold text-[var(--text-strong)]">{(losses?.totalHours || 0).toFixed(1)}h</span>
                  </div>
                </div>
              )}
            </SectionCard>
          )}

          {visibleWidgetIds.has('muda') && (
            <SectionCard
              eyebrow="Signals"
              title="Active muda watchlist"
              description="Open waste observations that still require attention or assignment."
              action={<Link href="/gemba" className="text-sm font-semibold text-blue-600 hover:text-blue-700">Open Gemba</Link>}
            >
              {mudaSignals.length === 0 ? (
                <EmptyState icon={Eye} title="No open muda signals" description="When operators or leaders identify waste, it will surface here for review." />
              ) : (
                <div className="space-y-3">
                  {mudaSignals.slice(0, 5).map((signal) => (
                    <div key={signal.id} className="rounded-[1rem] border border-[var(--border-default)] bg-[var(--surface-1)] p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-strong)]">{WASTE_LABELS[signal.wasteCategory] || signal.wasteCategory}</p>
                          <p className="mt-1 text-sm text-[var(--text-muted)] line-clamp-2">{signal.description}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${SEVERITY_CLASS[signal.severity] || SEVERITY_CLASS.medium}`}>
                          {signal.severity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {visibleWidgetIds.has('actions') && (
            <SectionCard
              eyebrow="Actions"
              title="Next moves"
              description="Jump directly into the operational workflows that keep this shift moving."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { href: '/shopfloor', label: 'Record Production', icon: Factory, meta: 'Close runs, post quantities' },
                  { href: '/quality', label: 'Quality Checks', icon: ShieldCheck, meta: 'Inspections, NCR, CAPA' },
                  { href: '/equipment', label: 'Maintenance', icon: Wrench, meta: 'Plans, logs, CILT' },
                  { href: '/tools/kaizen', label: 'Kaizen Board', icon: Lightbulb, meta: 'Capture and review ideas' },
                ].map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link key={action.href} href={action.href} className="interactive-card p-4 group">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="rounded-xl bg-[var(--brand-soft)] p-2.5 text-[var(--brand)]">
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[var(--text-strong)]">{action.label}</p>
                            <p className="mt-1 text-[13px] leading-5 text-[var(--text-muted)]">{action.meta}</p>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-[var(--text-muted)] transition group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}
