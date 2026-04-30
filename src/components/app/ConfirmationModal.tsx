import { useEffect, useMemo, useState } from 'react';

interface TypedConfirmationConfig {
  expectedValue: string;
  helperText?: string;
  inputLabel?: string;
  placeholder?: string;
}

export interface ConfirmationModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  bullets?: string[];
  typedConfirmation?: TypedConfirmationConfig;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  bullets = [],
  typedConfirmation,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  const [typedValue, setTypedValue] = useState('');

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setTypedValue('');
    }
  }, [open, typedConfirmation?.expectedValue]);

  if (!open) return null;

  const typedConfirmationSatisfied = useMemo(() => {
    if (!typedConfirmation) return true;
    return typedValue.trim() === typedConfirmation.expectedValue;
  }, [typedConfirmation, typedValue]);

  const confirmButtonClass = tone === 'danger'
    ? 'rounded-xl bg-gradient-to-r from-rose-600 to-red-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-rose-500 hover:to-red-400'
    : 'rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-cyan-400 hover:to-blue-400';

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/85 px-5 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
        className="w-full max-w-xl rounded-[1.4rem] border border-white/15 bg-slate-950/95 p-6 shadow-[0_30px_60px_rgba(0,0,0,0.5)]"
      >
        <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-sky-200/80">Confirm Action</p>
        <h2 id="confirmation-modal-title" className="mt-2 text-3xl font-semibold tracking-tight text-white">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">{message}</p>

        {bullets.length > 0 ? (
          <ul className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-black/20 px-5 py-4 text-sm text-slate-200">
            {bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        ) : null}

        {typedConfirmation ? (
          <div className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-950/20 px-5 py-4">
            <label className="block text-[0.72rem] font-bold uppercase tracking-[0.14em] text-amber-200/85" htmlFor="confirmation-typed-input">
              {typedConfirmation.inputLabel ?? 'Type to confirm'}
            </label>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {typedConfirmation.helperText ?? 'Type the required confirmation text exactly to continue.'}
            </p>
            <p className="mt-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm font-semibold text-white">
              {typedConfirmation.expectedValue}
            </p>
            <input
              id="confirmation-typed-input"
              type="text"
              value={typedValue}
              onChange={(event) => setTypedValue(event.target.value)}
              placeholder={typedConfirmation.placeholder ?? typedConfirmation.expectedValue}
              className="mt-3 w-full rounded-xl border border-white/15 bg-slate-950/55 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
            />
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            className="rounded-xl border border-white/15 bg-white/8 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-white/12"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={confirmButtonClass}
            disabled={!typedConfirmationSatisfied}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}