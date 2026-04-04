'use client';

import { useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Sparkline } from './charts';

type Variant = 'blue' | 'green' | 'orange' | 'amber' | 'purple' | 'slate';

const VARIANT_MAP: Record<Variant, {
  bg: string;
  iconBg: string;
  accent: string;
  sparkColor: string;
}> = {
  blue: {
    bg: 'bg-gradient-to-br from-sky-700 via-blue-700 to-blue-900',
    iconBg: 'bg-blue-400/20',
    accent: 'text-blue-200',
    sparkColor: '#93c5fd',
  },
  green: {
    bg: 'bg-gradient-to-br from-emerald-500 to-teal-700',
    iconBg: 'bg-emerald-400/20',
    accent: 'text-emerald-200',
    sparkColor: '#6ee7b7',
  },
  orange: {
    bg: 'bg-gradient-to-br from-amber-500 to-orange-700',
    iconBg: 'bg-amber-400/20',
    accent: 'text-amber-200',
    sparkColor: '#fcd34d',
  },
  amber: {
    bg: 'bg-gradient-to-br from-amber-500 to-orange-700',
    iconBg: 'bg-amber-400/20',
    accent: 'text-amber-200',
    sparkColor: '#fcd34d',
  },
  purple: {
    bg: 'bg-gradient-to-br from-cyan-600 to-blue-800',
    iconBg: 'bg-sky-300/20',
    accent: 'text-sky-200',
    sparkColor: '#7dd3fc',
  },
  slate: {
    bg: 'bg-gradient-to-br from-slate-600 to-slate-700',
    iconBg: 'bg-slate-400/20',
    accent: 'text-slate-200',
    sparkColor: '#cbd5e1',
  },
};

interface GradientStatCardProps {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  variant: Variant;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'flat';
  trendLabel?: string;
  sparkData?: number[];
  delay?: number;
}

function useCountUp(target: number, duration = 800, decimals = 0, delay = 0) {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number>(undefined);
  const safeTarget = typeof target === 'number' && !isNaN(target) ? target : 0;

  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = performance.now();
      const animate = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        setCurrent(parseFloat((eased * safeTarget).toFixed(decimals)));
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animate);
        }
      };
      rafRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [safeTarget, duration, decimals, delay]);

  return current;
}

export function GradientStatCard({
  label,
  value,
  suffix = '',
  prefix = '',
  decimals = 0,
  variant,
  icon: Icon,
  trend,
  trendLabel,
  sparkData,
  delay = 0,
}: GradientStatCardProps) {
  const animated = useCountUp(value, 800, decimals, delay);
  const v = VARIANT_MAP[variant];

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up' ? 'text-emerald-200' : trend === 'down' ? 'text-red-200' : 'text-white/50';

  return (
    <div
      className={`${v.bg} rounded-[var(--radius-xl)] p-5 text-white
                  relative overflow-hidden group
                  hover:-translate-y-1 hover:shadow-2xl`}
      style={{ animationDelay: `${delay}ms`, transition: 'all var(--motion-base) ease' }}
    >
      {/* Decorative blur orb */}
      <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10 blur-2xl" />

      <div className="relative z-10">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-card-label text-white/70">{label}</p>
          <div className={`w-9 h-9 rounded-xl ${v.iconBg} backdrop-blur-sm
                          flex items-center justify-center`}>
            <Icon className="w-4.5 h-4.5 text-white/80" />
          </div>
        </div>

        {/* Value + trend */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-kpi text-white leading-none">
              {prefix}{animated}{suffix}
            </p>
            {trend && (
              <div className={`flex items-center gap-1 mt-2 ${trendColor}`}>
                <TrendIcon className="w-3 h-3" />
                <span className="text-[11px] font-medium">{trendLabel}</span>
              </div>
            )}
          </div>

          {/* Sparkline */}
          {sparkData && sparkData.length > 1 && (
            <div className="w-24 opacity-60 group-hover:opacity-100 transition-opacity">
              <Sparkline data={sparkData} color={v.sparkColor} height={36} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
