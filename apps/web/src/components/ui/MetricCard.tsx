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
    brand: 'bg-[linear-gradient(145deg,#0f172a_0%,#1d4ed8_65%,#2563eb_100%)] text-white border-0',
    success: 'bg-[linear-gradient(145deg,#047857_0%,#059669_55%,#10b981_100%)] text-white border-0',
    danger: 'bg-[linear-gradient(145deg,#991b1b_0%,#dc2626_58%,#ef4444_100%)] text-white border-0',
    warning: 'bg-[linear-gradient(145deg,#b45309_0%,#d97706_55%,#f59e0b_100%)] text-white border-0',
    production: 'bg-[linear-gradient(145deg,#78350f_0%,#b45309_45%,#f59e0b_100%)] text-white border-0',
  };
  const isGradient = variant !== 'default';

  return (
    <div className={`relative overflow-hidden rounded-[var(--radius-xl)] p-5 shadow-[var(--shadow-sm)] ${variants[variant]} ${className || ''}`}>
      {isGradient && (
        <>
          <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/12 blur-2xl" />
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                'linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)',
            }}
          />
        </>
      )}
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
