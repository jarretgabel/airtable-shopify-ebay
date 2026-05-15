import { FormEvent, useState } from 'react';
import { useAuthStore } from '@/stores/auth/authStore';

const TEST_USERS = [
  { label: 'Admin', email: 'admin@example.com', password: 'Admin123!' },
  { label: 'Owner', email: 'owner@example.com', password: 'Owner123!' },
  { label: 'Developer', email: 'developer@example.com', password: 'Developer123!' },
  { label: 'Processor', email: 'processor@example.com', password: 'Processor123!' },
  { label: 'Tester', email: 'tester@example.com', password: 'Tester123!' },
  { label: 'Photographer', email: 'photographer@example.com', password: 'Photographer123!' },
] as const;

interface LoginScreenProps {
  onLoggedIn: () => void;
}

export function LoginScreen({ onLoggedIn }: LoginScreenProps) {
  const login = useAuthStore((state) => state.login);
  const requestPasswordReset = useAuthStore((state) => state.requestPasswordReset);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeSampleEmail, setActiveSampleEmail] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState<string | null>(null);

  async function submitLogin(nextEmail: string, nextPassword: string, sampleEmail: string | null = null): Promise<void> {
    if (submitting) return;

    setActiveSampleEmail(sampleEmail);
    setSubmitting(true);
    const result = await login(nextEmail, nextPassword);
    setSubmitting(false);
    setActiveSampleEmail(null);
    if (!result.success) {
      setError(result.message);
      return;
    }

    setError(null);
    onLoggedIn();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await submitLogin(email, password, null);
  }

  async function handleForgotPassword(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const result = await requestPasswordReset(resetEmail);
    setResetStatus(result.message);
  }

  async function handleUseSampleAccount(sample: (typeof TEST_USERS)[number]): Promise<void> {
    setEmail(sample.email);
    setPassword(sample.password);
    setError(null);
    await submitLogin(sample.email, sample.password, sample.email);
  }

  function handleLoginEnterKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  const labelClassName = 'text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-slate-300';
  const inputClassName = 'w-full rounded-xl border border-white/15 bg-slate-950/55 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30';
  const revealButtonClassName = 'shrink-0 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-white/10';

  return (
    <main className="min-h-screen px-5 py-8 text-slate-100">
      <section className="mx-auto w-full max-w-xl rounded-[1.4rem] border border-white/15 bg-slate-950/70 p-6 shadow-[0_24px_48px_rgba(6,13,23,0.45)] backdrop-blur">
        <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-sky-200/80">Listing Control Center</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white">Sign in</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">Access is permission-based per user account.</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-2.5">
          <label className={labelClassName} htmlFor="login-email">Email</label>
          <input
            id="login-email"
            className={inputClassName}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onKeyDown={handleLoginEnterKeyDown}
            required
            autoComplete="email"
          />

          <div className="mt-2 flex items-center justify-between gap-3">
            <label className={labelClassName} htmlFor="login-password">Password</label>
            <button
              type="button"
              className={revealButtonClassName}
              aria-controls="login-password"
              aria-pressed={showPassword}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? 'Hide' : 'Reveal'}
            </button>
          </div>
          <input
            id="login-password"
            className={inputClassName}
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={handleLoginEnterKeyDown}
            required
            autoComplete="current-password"
          />

          {error && <p className="mt-1 text-sm text-rose-300">{error}</p>}

          <button type="submit" disabled={submitting} className="mt-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-cyan-400 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? 'Logging In...' : 'Log In'}
          </button>
        </form>

        <button
          type="button"
          className="mt-4 text-left text-sm font-medium text-sky-300 transition hover:text-sky-200"
          onClick={() => setShowForgotPassword((value) => !value)}
        >
          Forgot password?
        </button>

        {showForgotPassword && (
          <form onSubmit={handleForgotPassword} className="mt-4 flex flex-col gap-2.5 border-t border-white/10 pt-4">
            <label className={labelClassName} htmlFor="forgot-email">Account email</label>
            <input
              id="forgot-email"
              className={inputClassName}
              type="email"
              value={resetEmail}
              onChange={(event) => setResetEmail(event.target.value)}
              required
              autoComplete="email"
            />
            <button type="submit" className="rounded-xl border border-white/15 bg-white/8 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-white/12">
              Send reset email
            </button>
            {resetStatus && <p className="text-sm text-emerald-300">{resetStatus}</p>}
          </form>
        )}

        <div className="mt-5 border-t border-white/10 pt-4 text-xs leading-6 text-slate-400">
          <p className="m-0 font-semibold uppercase tracking-[0.12em] text-sky-200/80">Test account logins</p>
          {TEST_USERS.map((user) => (
            <div key={user.email} className="flex items-center justify-between gap-3 py-1.5">
              <p className="m-0 min-w-0 flex-1 truncate">
                {user.label}: {user.email} / {user.password}
              </p>
              <button
                type="button"
                aria-label={`Log In as ${user.label}`}
                className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-slate-100 transition hover:bg-white/10"
                disabled={submitting}
                onClick={() => {
                  void handleUseSampleAccount(user);
                }}
              >
                {submitting && activeSampleEmail === user.email ? 'Logging In...' : 'Log In'}
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
