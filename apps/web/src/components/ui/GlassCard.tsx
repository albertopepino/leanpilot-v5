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
  const base = `
    bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl
    rounded-2xl border border-white/20 dark:border-gray-700/50
    shadow-lg shadow-gray-200/40 dark:shadow-none
    dark:ring-1 dark:ring-gray-700/50
    ${PADDING[padding]}
    transition-all duration-200
  `;

  const hoverClass =
    hover || onClick
      ? 'hover:-translate-y-0.5 hover:shadow-xl hover:shadow-gray-300/40 dark:hover:ring-gray-600 cursor-pointer'
      : '';

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-full text-left ${base} ${hoverClass} ${className}`}
      >
        {children}
      </button>
    );
  }

  return <div className={`${base} ${hoverClass} ${className}`}>{children}</div>;
}
