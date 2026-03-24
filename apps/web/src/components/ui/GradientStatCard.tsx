'use client';

import { useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Sparkline } from './charts';

type Variant = 'blue' | 'green' | 'orange' | 'purple' | 'slate';

const VARIANT_MAP: Record<Variant, {
  bg: string;
  iconBg: string;
  accent: string;
  sparkColor: string;
}> = {
  blue: {
    bg: 'bg-gradient-to-br from-slate-800 via-blue-900 to-indigo-900',
    iconBg: 'bg-blue-500/20',
    accent: 'text-blue-300',
    sparkColor: '#60a5fa',
  },
  green: {
    bg: 'bg-gradient-to-br from-slate-800 via-emerald-900 to-teal-900',
    iconBg: 'bg-emerald-500/20',
    accent: 'text-emerald-300',
    sparkColor: '#34d399',
  },
  orange: {
    bg: 'bg-gradient-to-br from-slate-800 via-orange-900 to-amber-900',
    iconBg: 'bg-orange-500/20',
    accent: 'text-amber-300',
    sparkColor: '#fbbf24',
  },
  purple: {
    bg: 'bg-gradient-to-br from-slate-800 via-violet-900 to-purple-900',
    iconBg: 'bg-violet-500/20',
    accent: 'text-violet-300',
    sparkColor: '#a78bfa',
  },
  slate: {
    bg: 'bg-gradient-to-br from-gray-800 to-slate-900',
    iconBg: 'bg-gray-500/20',
    accent: 'text-gray-300',
    sparkColor: '#94a3b8',
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
  const rafRef = useRef<number>();
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
    trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400';

  return (
    <div
      className={`${v.bg} rounded-2xl p-5 text-white
                  relative overflow-hidden group
                  hover:-translate-y-1 hover:shadow-2xl transition-all duration-300`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Subtle noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'1\'/%3E%3C/svg%3E")' }} />

      <div className="relative z-10">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50">{label}</p>
          <div className={`w-9 h-9 rounded-xl ${v.iconBg} backdrop-blur-sm
                          flex items-center justify-center`}>
            <Icon className="w-4.5 h-4.5 text-white/80" />
          </div>
        </div>

        {/* Value + trend */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-extrabold tracking-tight tabular-nums leading-none">
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
