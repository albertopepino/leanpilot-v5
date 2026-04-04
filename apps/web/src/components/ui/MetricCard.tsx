'use client';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: { value: number; label: string };
  variant?: 'default' | 'brand' | 'success' | 'danger' | 'warning' | 'production';
  className?: string;
}

export function MetricCard({ label, value, unit, trend, variant = 'default', className }: MetricCardProps) {
  const variants = {
    default: 'bg-[var(--surface-0)] border border-[var(--border-default)]',
    brand: 'bg-gradient-to-br from-blue-600 to-blue-700 text-white border-0',
    success: 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0',
    danger: 'bg-gradient-to-br from-red-500 to-red-600 text-white border-0',
    warning: 'bg-gradient-to-br from-amber-500 to-amber-600 text-white border-0',
    production: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white border-0',
  };
  const isGradient = variant !== 'default';

  return (
    <div className={`relative overflow-hidden rounded-[var(--radius-xl)] p-5 shadow-[var(--shadow-sm)] ${variants[variant]} ${className || ''}`}>
      {isGradient && <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10 blur-2xl" />}
      <p className={`text-card-label ${isGradient ? 'text-white/70' : ''}`}>{label}</p>
      <p className={`text-kpi mt-1 ${isGradient ? 'text-white' : 'text-[var(--text-strong)]'}`}>
        {value}{unit && <span className="text-sm font-normal ml-1 opacity-70">{unit}</span>}
      </p>
      {trend && (
        <div className={`flex items-center gap-1 mt-2 text-sm ${
          trend.value >= 0
            ? isGradient ? 'text-emerald-200' : 'text-emerald-600'
            : isGradient ? 'text-red-200' : 'text-red-600'
        }`}>
          <span>{trend.value >= 0 ? '\u2191' : '\u2193'} {Math.abs(trend.value)}%</span>
          <span className="opacity-60">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
