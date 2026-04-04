'use client';

type BrandLogoProps = {
  size?: 'sm' | 'md' | 'lg';
  mode?: 'mark' | 'lockup';
  theme?: 'light' | 'dark';
  subtitle?: string;
  className?: string;
};

const SIZE_MAP = {
  sm: {
    mark: 'h-9 w-9',
    icon: 'h-5 w-5',
    title: 'text-base',
    subtitle: 'text-[10px]',
  },
  md: {
    mark: 'h-11 w-11',
    icon: 'h-6 w-6',
    title: 'text-xl',
    subtitle: 'text-[11px]',
  },
  lg: {
    mark: 'h-14 w-14',
    icon: 'h-8 w-8',
    title: 'text-2xl',
    subtitle: 'text-xs',
  },
} as const;

function BrandMark({
  className = '',
  iconClassName = '',
}: {
  className?: string;
  iconClassName?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[1.15rem] bg-[linear-gradient(145deg,#0f172a_0%,#1d4ed8_62%,#2563eb_100%)] shadow-[0_14px_36px_rgba(37,99,235,0.28)] ${className}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_20%,rgba(255,255,255,0.16),transparent_34%),radial-gradient(circle_at_82%_80%,rgba(245,158,11,0.22),transparent_28%)]" />
      <svg
        viewBox="0 0 64 64"
        className={`relative z-10 ${iconClassName}`}
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M14 42V22.5C14 19.462 16.462 17 19.5 17H31"
          stroke="white"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M24 47H44.5C47.538 47 50 44.538 50 41.5V29"
          stroke="#FDBA74"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M28 22H42L50 30"
          stroke="#7DD3FC"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="14" cy="42" r="4" fill="white" />
        <circle cx="28" cy="22" r="4" fill="#BFDBFE" />
        <circle cx="50" cy="30" r="4" fill="#FCD34D" />
      </svg>
    </div>
  );
}

export function BrandLogo({
  size = 'md',
  mode = 'lockup',
  theme = 'light',
  subtitle = 'Operations Intelligence',
  className = '',
}: BrandLogoProps) {
  const styles = SIZE_MAP[size];
  const titleColor = theme === 'dark' ? 'text-white' : 'text-[var(--text-strong)]';
  const subtitleColor =
    theme === 'dark' ? 'text-white/60' : 'text-[var(--text-muted)]';

  if (mode === 'mark') {
    return (
      <BrandMark
        className={`${styles.mark} ${className}`}
        iconClassName={styles.icon}
      />
    );
  }

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <BrandMark className={styles.mark} iconClassName={styles.icon} />
      <div className="min-w-0">
        <div
          className={`font-brand leading-none tracking-[-0.03em] ${styles.title} ${titleColor}`}
        >
          LeanPilot
        </div>
        <div
          className={`${styles.subtitle} mt-1 font-semibold uppercase tracking-[0.18em] ${subtitleColor}`}
        >
          {subtitle}
        </div>
      </div>
    </div>
  );
}
