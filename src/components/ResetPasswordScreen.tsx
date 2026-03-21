import { FormEvent, useState } from 'react';
import { useAuthStore } from '@/stores/auth/authStore';

interface ResetPasswordScreenProps {
  token: string | null;
  onResetSuccess: () => void;
  onBackToLogin: () => void;
}

export function ResetPasswordScreen({ token, onResetSuccess, onBackToLogin }: ResetPasswordScreenProps) {
  const resetPassword = useAuthStore((state) => state.resetPassword);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (!token) {
      setError('Missing reset token. Please use the reset link from your email.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const result = resetPassword(token, password);
    if (!result.success) {
      setError(result.message);
      return;
    }

    setError(null);
    setStatus(result.message);
    window.setTimeout(onResetSuccess, 1000);
  }

  const labelClassName = 'text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-slate-300';
  const inputClassName = 'w-full rounded-xl border border-white/15 bg-slate-950/55 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30';

  return (
    <main className="min-h-screen px-5 py-8 text-slate-100">
      <section className="mx-auto w-full max-w-xl rounded-[1.4rem] border border-white/15 bg-slate-950/70 p-6 shadow-[0_24px_48px_rgba(6,13,23,0.45)] backdrop-blur">
        <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-sky-200/80">Account Recovery</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white">Reset your password</h1>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-2.5">
          <label className={labelClassName} htmlFor="new-password">New password</label>
          <input
            id="new-password"
            className={inputClassName}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="new-password"
          />

          <label className={`${labelClassName} mt-2`} htmlFor="confirm-password">Confirm password</label>
          <input
            id="confirm-password"
            className={inputClassName}
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            autoComplete="new-password"
          />

          {error && <p className="mt-1 text-sm text-rose-300">{error}</p>}
          {status && <p className="mt-1 text-sm text-emerald-300">{status}</p>}

          <button type="submit" className="mt-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-cyan-400 hover:to-blue-400">
            Reset password
          </button>
        </form>

        <button type="button" className="mt-4 text-left text-sm font-medium text-sky-300 transition hover:text-sky-200" onClick={onBackToLogin}>
          Back to login
        </button>
      </section>
    </main>
  );
}
