'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const VARIANT_STYLES = {
  danger: {
    icon: 'bg-[var(--danger-soft)] text-red-600 dark:text-red-400',
    button: 'bg-[var(--danger)] hover:brightness-110 focus:ring-red-500',
  },
  warning: {
    icon: 'bg-[var(--warning-soft)] text-amber-600 dark:text-amber-400',
    button: 'bg-[var(--warning)] hover:brightness-110 focus:ring-amber-500',
  },
  info: {
    icon: 'bg-[var(--info-soft)] text-cyan-600 dark:text-cyan-400',
    button: 'bg-[var(--info)] hover:brightness-110 focus:ring-cyan-500',
  },
};

export function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  variant = 'warning', onConfirm, onCancel, loading,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const styles = VARIANT_STYLES[variant];

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div
        className="relative max-w-md w-full mx-4 p-6 rounded-[var(--radius-xl)] shadow-[var(--shadow-lg)] animate-scale-in"
        style={{
          background: 'var(--surface-0)',
          border: '1px solid var(--border-default)',
        }}
      >
        <button onClick={onCancel} className="absolute top-4 right-4 p-1 rounded-lg
          hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        </button>

        <div className="flex gap-4">
          <div className={`w-10 h-10 rounded-[var(--radius-lg)] flex items-center justify-center flex-shrink-0 ${styles.icon}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-strong)' }}>{title}</h3>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{message}</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button ref={cancelRef} onClick={onCancel} disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-[var(--radius-lg)] transition-colors"
            style={{
              background: 'var(--surface-2)',
              color: 'var(--text-strong)',
            }}>
            {cancelLabel}
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={`px-4 py-2 text-sm font-medium rounded-[var(--radius-lg)] text-white transition-colors
              focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${styles.button}`}>
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
