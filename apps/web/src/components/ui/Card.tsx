interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
  interactive?: boolean;
  padding?: 'sm' | 'md' | 'lg' | 'none';
}

const PADDING = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
};

export function Card({ children, className = '', onClick, hover = false, interactive = false, padding = 'md' }: CardProps) {
  const isInteractive = interactive || hover || !!onClick;
  const base = isInteractive ? 'interactive-card' : 'surface-card';
  const padClass = PADDING[padding];

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-full text-left ${base} ${padClass} ${className}`}
      >
        {children}
      </button>
    );
  }

  return <div className={`${base} ${padClass} ${className}`}>{children}</div>;
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mb-4 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`font-medium ${className}`} style={{ color: 'var(--text-strong)' }}>{children}</h3>;
}

export function CardDescription({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-sm ${className}`} style={{ color: 'var(--text-muted)' }}>{children}</p>;
}
