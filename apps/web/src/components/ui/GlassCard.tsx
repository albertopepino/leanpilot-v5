'use client';

import { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
  padding?: 'sm' | 'md' | 'lg' | 'none';
}

const PADDING = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function GlassCard({
  children,
  className = '',
  onClick,
  hover = false,
  padding = 'md',
}: GlassCardProps) {
  const base = `surface-glass ${PADDING[padding]}`;

  const hoverClass =
    hover || onClick
      ? 'hover:-translate-y-0.5 hover:shadow-lg cursor-pointer'
      : '';

  const style = { transition: `all var(--motion-base) ease` };

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-full text-left ${base} ${hoverClass} ${className}`}
        style={style}
      >
        {children}
      </button>
    );
  }

  return (
    <div className={`${base} ${hoverClass} ${className}`} style={style}>
      {children}
    </div>
  );
}
