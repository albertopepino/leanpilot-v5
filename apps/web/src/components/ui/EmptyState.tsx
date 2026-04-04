'use client';

import { type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="surface-card relative overflow-hidden p-12 text-center animate-fade-in-up">
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(37,99,235,0.4),transparent)]" />
      <div
        className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
        style={{ background: 'linear-gradient(145deg, var(--surface-2), var(--surface-1))' }}
      >
        <Icon className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
      </div>
      <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-strong)' }}>{title}</h3>
      <p className="text-sm max-w-md mx-auto mb-6 text-center leading-relaxed text-muted-readable">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="brand-button px-5 py-2.5 text-sm font-medium
                     focus:outline-none focus:ring-2 focus:ring-offset-2"
          style={{ '--tw-ring-color': 'var(--brand)' } as React.CSSProperties}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
