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
    <div className="surface-card p-12 text-center animate-fade-in-up">
      <div
        className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
        style={{ background: 'var(--surface-2)' }}
      >
        <Icon className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
      </div>
      <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-strong)' }}>{title}</h3>
      <p className="text-sm max-w-md mx-auto mb-6 text-center leading-relaxed text-muted-readable">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors
                     focus:outline-none focus:ring-2 focus:ring-offset-2"
          style={{ '--tw-ring-color': 'var(--brand)' } as React.CSSProperties}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
