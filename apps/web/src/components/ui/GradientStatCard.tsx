'use client';

import { useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

type Gradient = 'blue' | 'green' | 'orange' | 'purple' | 'corporate';

const GRADIENT_MAP: Record<Gradient, { bg: string; shadow: string }> = {
  blue: {
    bg: 'bg-gradient-to-br from-blue-600 to-violet-600',
    shadow: 'shadow-blue-500/25',
  },
  green: {
    bg: 'bg-gradient-to-br from-emerald-600 to-emerald-400',
    shadow: 'shadow-emerald-500/25',
  },
  orange: {
    bg: 'bg-gradient-to-br from-orange-600 to-amber-400',
    shadow: 'shadow-orange-500/25',
  },
  purple: {
    bg: 'bg-gradient-to-br from-violet-600 to-purple-400',
    shadow: 'shadow-violet-500/25',
  },
  corporate: {
    bg: 'bg-gradient-to-br from-blue-800 to-blue-500',
    shadow: 'shadow-blue-600/25',
  },
};

interface GradientStatCardProps {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  gradient: Gradient;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'flat';
  trendLabel?: string;
  delay?: number;
}

function useCountUp(target: number, duration = 800, decimals = 0, delay = 0) {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number>();

  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = performance.now();
      const animate = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // easeOutExpo
        const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        setCurrent(parseFloat((eased * target).toFixed(decimals)));
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
  }, [target, duration, decimals, delay]);

  return current;
}

export function GradientStatCard({
  label,
  value,
  suffix = '',
  prefix = '',
  decimals = 0,
  gradient,
  icon: Icon,
  trend,
  trendLabel,
  delay = 0,
}: GradientStatCardProps) {
  const animated = useCountUp(value, 800, decimals, delay);
  const { bg, shadow } = GRADIENT_MAP[gradient];

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-white' : trend === 'down' ? 'text-red-200' : 'text-white/60';

  return (
    <div
      className={`${bg} rounded-2xl p-6 text-white shadow-lg ${shadow}
                  relative overflow-hidden group
                  hover:-translate-y-0.5 hover:shadow-xl transition-all duration-200`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Decorative blur circles */}
      <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl
                      group-hover:scale-110 transition-transform duration-500" />
      <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-white/5 rounded-full blur-xl" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-white/80">{label}</p>
          <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm
                          flex items-center justify-center">
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>

        <p className="text-3xl font-extrabold tracking-tight tabular-nums">
          {prefix}{animated}{suffix}
        </p>

        {trend && (
          <div className={`flex items-center gap-1.5 mt-2 ${trendColor}`}>
            <TrendIcon className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">{trendLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}
