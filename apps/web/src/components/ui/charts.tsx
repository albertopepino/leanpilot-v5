'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from 'recharts';

// ── Mini Sparkline (inline in KPI cards) ─────────────────────────────

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
}

export function Sparkline({ data, color = '#3b82f6', height = 32 }: SparklineProps) {
  const chartData = data.map((v, i) => ({ v, i }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#spark-${color.replace('#', '')})`}
          dot={false}
          isAnimationActive={true}
          animationDuration={800}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Progress Ring (circular gauge) ───────────────────────────────────

interface ProgressRingProps {
  value: number;       // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
  children?: React.ReactNode;
}

export function ProgressRing({
  value,
  size = 80,
  strokeWidth = 6,
  color = '#3b82f6',
  bgColor = '#e5e7eb',
  children,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    const timer = setTimeout(() => {
      const safeValue = Math.min(100, Math.max(0, isNaN(value) ? 0 : value));
      setOffset(circumference - (safeValue / 100) * circumference);
    }, 100);
    return () => clearTimeout(timer);
  }, [value, circumference]);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

// ── Area Trend Chart ─────────────────────────────────────────────────

interface TrendChartProps {
  data: { name: string; value: number; value2?: number }[];
  color1?: string;
  color2?: string;
  height?: number;
  label1?: string;
  label2?: string;
}

export function TrendChart({
  data,
  color1 = '#3b82f6',
  color2 = '#8b5cf6',
  height = 220,
  label1 = 'Value',
  label2,
}: TrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="areaGrad1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color1} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color1} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="areaGrad2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color2} stopOpacity={0.15} />
            <stop offset="100%" stopColor={color2} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
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
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color1}
          strokeWidth={2.5}
          fill="url(#areaGrad1)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: color1 }}
          name={label1}
        />
        {label2 && (
          <Area
            type="monotone"
            dataKey="value2"
            stroke={color2}
            strokeWidth={2}
            fill="url(#areaGrad2)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: color2 }}
            name={label2}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Horizontal Bar Chart ─────────────────────────────────────────────

interface HBarChartProps {
  data: { name: string; value: number; color: string }[];
  height?: number;
}

export function HBarChart({ data, height = 220 }: HBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
        <YAxis
          type="category"
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: '#6b7280', fontWeight: 500 }}
          width={90}
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
          formatter={(val: number) => [`${val.toFixed(1)}h`, 'Hours']}
        />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Donut Chart ──────────────────────────────────────────────────────

interface DonutChartProps {
  data: { name: string; value: number; color: string }[];
  size?: number;
  innerRadius?: number;
  outerRadius?: number;
  children?: React.ReactNode;
}

export function DonutChart({
  data,
  size = 180,
  innerRadius = 55,
  outerRadius = 75,
  children,
}: DonutChartProps) {
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <ResponsiveContainer width={size} height={size}>
        <PieChart>
          <Pie
            data={data}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={3}
            dataKey="value"
            strokeWidth={0}
            animationBegin={0}
            animationDuration={800}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(8px)',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
              fontSize: '13px',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}
