import React from 'react';
import { Loader2, X } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  variant?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Ya, Simpan',
  cancelLabel = 'Batal',
  loading = false,
  variant = 'primary',
  onConfirm,
  onCancel,
  children,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#041226]/65 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="glass-panel w-full max-w-lg rounded-2xl p-6 text-slate-900 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id="confirm-modal-title" className="text-lg font-semibold text-[#0B2B52]">
              {title}
            </h3>
            {description && (
              <p className="mt-1 text-sm text-slate-600">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            aria-label="Tutup dialog"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {children && <div className="mt-4">{children}</div>}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="min-h-10 rounded-xl border border-slate-300 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`min-h-10 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white transition-all whitespace-nowrap shrink-0 disabled:opacity-60 ${
              variant === 'danger'
                ? 'bg-rose-600 hover:bg-rose-700 shadow-sm'
                : 'bg-gradient-to-r from-[#0B2B52] to-[#1565C0] hover:from-[#0e3566] hover:to-[#1976D2] shadow-md'
            }`}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{loading ? 'Menyimpan...' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
