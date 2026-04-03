'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Gauge, TrendingUp, TrendingDown, Clock, Zap, CheckCircle, Download, ArrowUp, ArrowDown } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { SkeletonList } from '@/components/ui/Skeleton';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';

interface WSData {
  workstationId: string;
  workstationName: string;
  workstationCode: string;
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  totalProduced: number;
  totalScrap: number;
  operatingMinutes: number;
  downtimeMinutes: number;
}

interface OEEApiResponse {
  period: string;
  since: string;
  workstations: WSData[];
}

interface OEEData {
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  totalProduced: number;
  totalScrap: number;
  plannedMinutes: number;
  operatingMinutes: number;
  downtimeMinutes: number;
  workstations: { id: string; name: string; oee: number; availability: number; performance: number; quality: number }[];
}

function computeOEE(raw: OEEApiResponse): OEEData {
  const ws = raw.workstations || [];
  const totalProduced = ws.reduce((s, w) => s + w.totalProduced, 0);
  const totalScrap = ws.reduce((s, w) => s + w.totalScrap, 0);
  const operatingMinutes = ws.reduce((s, w) => s + w.operatingMinutes, 0);
  const downtimeMinutes = ws.reduce((s, w) => s + w.downtimeMinutes, 0);
  const plannedMinutes = operatingMinutes + downtimeMinutes;
  const n = ws.length || 1;
  const availability = ws.reduce((s, w) => s + w.availability, 0) / n;
  const performance = ws.reduce((s, w) => s + w.performance, 0) / n;
  const quality = ws.reduce((s, w) => s + w.quality, 0) / n;
  const oee = (availability / 100) * (performance / 100) * (quality / 100) * 100;
  return {
    oee, availability, performance, quality,
    totalProduced, totalScrap, plannedMinutes, operatingMinutes, downtimeMinutes,
    workstations: ws.map(w => ({ id: w.workstationId, name: w.workstationName, oee: w.oee, availability: w.availability, performance: w.performance, quality: w.quality })),
  };
}

// SVG Donut gauge component
function DonutGauge({ value, label, color, size = 140 }: { value: number; label: string; color: string; size?: number }) {
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(value, 100) / 100) * circumference;
  const center = size / 2;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={center} cy={center} r={radius} fill="none"
            stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth={stroke}
          />
          <circle cx={center} cy={center} r={radius} fill="none"
            stroke={color} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">{value.toFixed(1)}%</span>
        </div>
      </div>
      <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-2">{label}</span>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

// ── OEE Trend types ────────────────────────────────────────────
interface OEETrendPoint {
  date: string;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
}

interface OEETrendResponse {
  insufficientData?: boolean;
  points?: OEETrendPoint[];
  thisWeek?: { oee: number };
  lastWeek?: { oee: number };
}

function OEETrendChart() {
  const [trend, setTrend] = useState<OEETrendResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<OEETrendResponse>('/dashboard/oee-trend?period=30d')
      .then(data => setTrend(data))
      .catch(() => setTrend(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mt-6">
        <div className="h-64 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-brand-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!trend || trend.insufficientData) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mt-6">
        <h3 className="font-medium text-gray-900 dark:text-white mb-3">OEE Trend (30 days)</h3>
        <div className="text-center py-8">
          <TrendingUp className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Need more production data to show trends. Run at least 5 shifts to start seeing OEE trends.
          </p>
        </div>
      </div>
    );
  }

  const points = trend.points || [];
  const thisWeekOee = trend.thisWeek?.oee ?? 0;
  const lastWeekOee = trend.lastWeek?.oee ?? 0;
  const delta = thisWeekOee - lastWeekOee;
  const deltaPositive = delta >= 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mt-6">
      <h3 className="font-medium text-gray-900 dark:text-white mb-4">OEE Trend (30 days)</h3>
      {points.length > 0 && (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
            />
            <YAxis
              domain={[0, 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(8px)',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
                fontSize: '13px',
              }}
              formatter={(val: number, name: string) => [`${val.toFixed(1)}%`, name]}
            />
            <Legend />
            <ReferenceLine y={85} stroke="#9ca3af" strokeDasharray="8 4" label={{ value: 'Target 85%', position: 'insideTopRight', fill: '#9ca3af', fontSize: 11 }} />
            <Line type="monotone" dataKey="oee" stroke="#3b82f6" strokeWidth={3} dot={false} name="OEE" />
            <Line type="monotone" dataKey="availability" stroke="#22c55e" strokeWidth={1.5} dot={false} name="Availability" />
            <Line type="monotone" dataKey="performance" stroke="#f97316" strokeWidth={1.5} dot={false} name="Performance" />
            <Line type="monotone" dataKey="quality" stroke="#a855f7" strokeWidth={1.5} dot={false} name="Quality" />
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Week-over-week comparison */}
      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center gap-4">
        <span className="text-sm text-gray-500 dark:text-gray-400">This week vs last week:</span>
        <div className="flex items-center gap-1.5">
          {deltaPositive ? (
            <ArrowUp className="w-4 h-4 text-green-500" />
          ) : (
            <ArrowDown className="w-4 h-4 text-red-500" />
          )}
          <span className={`text-sm font-bold ${deltaPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {deltaPositive ? '+' : ''}{delta.toFixed(1)}%
          </span>
          <span className="text-xs text-gray-400">
            ({thisWeekOee.toFixed(1)}% vs {lastWeekOee.toFixed(1)}%)
          </span>
        </div>
      </div>
    </div>
  );
}

export default function OEEPage() {
  const [data, setData] = useState<OEEData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    api.get<OEEApiResponse>('/dashboard/oee')
      .then(raw => { if (raw) setData(computeOEE(raw)); else setError('No OEE data available'); })
      .catch(e => setError(e.message || 'Failed to load OEE data'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <SkeletonList count={4} />
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
        <p className="text-red-700 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const oeeColor = data.oee >= 85 ? '#22c55e' : data.oee >= 60 ? '#eab308' : '#ef4444';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Gauge className="w-7 h-7 text-brand-600" />
            OEE Dashboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Overall Equipment Effectiveness — current shift
          </p>
        </div>
        <button
          onClick={() => api.downloadPdf('/reports/oee?period=week', 'oee-summary.pdf').catch(() => toast('error', 'Failed to export PDF'))}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <Download className="w-4 h-4" /> Export PDF
        </button>
      </div>

      {/* Main OEE gauge + A/P/Q breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 mb-6">
        <div className="flex flex-wrap items-center justify-center gap-12">
          <div className="relative">
            <DonutGauge value={data.oee} label="OEE" color={oeeColor} size={180} />
          </div>
          <div className="flex gap-8">
            <div className="relative">
              <DonutGauge value={data.availability} label="Availability" color="#3b82f6" size={120} />
            </div>
            <div className="relative">
              <DonutGauge value={data.performance} label="Performance" color="#8b5cf6" size={120} />
            </div>
            <div className="relative">
              <DonutGauge value={data.quality} label="Quality" color="#06b6d4" size={120} />
            </div>
          </div>
        </div>
        {data.oee >= 85 && (
          <div className="mt-4 text-center">
            <span className="text-sm text-green-600 dark:text-green-400 font-medium">World-class OEE (&ge;85%)</span>
          </div>
        )}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard icon={Zap} label="Produced" value={data.totalProduced.toLocaleString()} color="bg-blue-500" />
        <MetricCard icon={CheckCircle} label="Scrap" value={data.totalScrap.toLocaleString()}
          sub={data.totalProduced > 0 ? `${((data.totalScrap / data.totalProduced) * 100).toFixed(1)}% rate` : '—'}
          color="bg-red-500"
        />
        <MetricCard icon={Clock} label="Operating" value={`${data.operatingMinutes}m`}
          sub={`of ${data.plannedMinutes}m planned`} color="bg-green-500"
        />
        <MetricCard icon={TrendingUp} label="Downtime" value={`${data.downtimeMinutes}m`}
          sub={data.plannedMinutes > 0 ? `${((data.downtimeMinutes / data.plannedMinutes) * 100).toFixed(1)}%` : '—'}
          color="bg-orange-500"
        />
      </div>

      {/* Per-workstation breakdown */}
      {data.workstations && data.workstations.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-medium text-gray-900 dark:text-white">Workstation Breakdown</h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {data.workstations.map(ws => (
              <div key={ws.id} className="px-5 py-3 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900 dark:text-white">{ws.name}</span>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${ws.oee >= 85 ? 'bg-green-500' : ws.oee >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(ws.oee, 100)}%` }}
                      />
                    </div>
                    <span className={`text-sm font-mono font-bold min-w-[48px] text-right ${
                      ws.oee >= 85 ? 'text-green-600' : ws.oee >= 60 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {ws.oee.toFixed(1)}%
                    </span>
                  </div>
                  <div className="hidden md:flex gap-3 text-xs text-gray-400">
                    <span>A:{ws.availability.toFixed(0)}%</span>
                    <span>P:{ws.performance.toFixed(0)}%</span>
                    <span>Q:{ws.quality.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OEE Trend Chart */}
      <OEETrendChart />
    </div>
  );
}
