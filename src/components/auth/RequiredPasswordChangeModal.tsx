import { FormEvent, useEffect, useState } from 'react';
import { PASSWORD_POLICY_MESSAGE, validatePasswordPolicy } from '@/stores/auth/passwordPolicy';

interface RequiredPasswordChangeModalProps {
  userName: string;
  onSubmit: (nextPassword: string) => Promise<{ success: boolean; message: string }>;
  onLogout: () => void;
}

export function RequiredPasswordChangeModal({ userName, onSubmit, onLogout }: RequiredPasswordChangeModalProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (password !== confirmPassword) {
      setStatusMessage('New password and confirmation must match.');
      return;
    }

    const passwordPolicyError = validatePasswordPolicy(password);
    if (passwordPolicyError) {
      setStatusMessage(passwordPolicyError);
      return;
    }

    setSubmitting(true);
    const result = await onSubmit(password);
    setStatusMessage(result.message);
    setSubmitting(false);
  }

  const labelClassName = 'text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-slate-300';
  const inputClassName = 'w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30';
  const revealButtonClassName = 'shrink-0 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-white/10';

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/85 px-5 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="required-password-change-title"
        className="w-full max-w-lg rounded-[1.4rem] border border-white/15 bg-slate-950/95 p-6 shadow-[0_30px_60px_rgba(0,0,0,0.5)]"
      >
        <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-sky-200/80">Password Update Required</p>
        <h2 id="required-password-change-title" className="mt-2 text-3xl font-semibold tracking-tight text-white">
          Update your password
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {userName}, you need to set a new password before using the site. This prompt will continue to appear until your password is changed.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <label className={labelClassName} htmlFor="required-password">New password</label>
            <button
              type="button"
              className={revealButtonClassName}
              aria-controls="required-password required-password-confirm"
              aria-pressed={showPasswords}
              onClick={() => setShowPasswords((value) => !value)}
            >
              {showPasswords ? 'Hide' : 'Reveal'}
            </button>
          </div>
          <input
            id="required-password"
            className={inputClassName}
            type={showPasswords ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="new-password"
            autoFocus
          />

          <div className="mt-2 flex items-center justify-between gap-3">
            <label className={labelClassName} htmlFor="required-password-confirm">Confirm password</label>
            <button
              type="button"
              className={revealButtonClassName}
              aria-controls="required-password required-password-confirm"
              aria-pressed={showPasswords}
              onClick={() => setShowPasswords((value) => !value)}
            >
              {showPasswords ? 'Hide' : 'Reveal'}
            </button>
          </div>
          <input
            id="required-password-confirm"
            className={inputClassName}
            type={showPasswords ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            autoComplete="new-password"
          />

          <p className="text-[0.78rem] text-slate-400">{PASSWORD_POLICY_MESSAGE}</p>

          {statusMessage && <p className="mt-1 text-sm text-amber-200">{statusMessage}</p>}

          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-cyan-400 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Updating...' : 'Update Password'}
            </button>
            <button
              type="button"
              disabled={submitting}
              className="rounded-xl border border-white/15 bg-white/8 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onLogout}
            >
              Log Out
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}