import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import type { UserNotificationPreferences } from '@/stores/auth/authTypes';

type BooleanPreferenceKey = {
  [K in keyof UserNotificationPreferences]: UserNotificationPreferences[K] extends boolean ? K : never;
}[keyof UserNotificationPreferences];

const preferenceRows: Array<{ key: BooleanPreferenceKey; label: string }> = [
  { key: 'infoEnabled', label: 'Info notifications' },
  { key: 'successEnabled', label: 'Success notifications' },
  { key: 'warningEnabled', label: 'Warning notifications' },
  { key: 'errorEnabled', label: 'Error notifications' },
];

export function SettingsTab() {
  const users = useAuthStore((state) => state.users);
  const currentUserId = useAuthStore((state) => state.currentUserId);
  const updateCurrentUserEmail = useAuthStore((state) => state.updateCurrentUserEmail);
  const confirmEmailChange = useAuthStore((state) => state.confirmEmailChange);
  const updateCurrentUserPassword = useAuthStore((state) => state.updateCurrentUserPassword);
  const logout = useAuthStore((state) => state.logout);
  const location = useLocation();
  const navigate = useNavigate();
  const updateCurrentUserNotificationPreference = useAuthStore((state) => state.updateCurrentUserNotificationPreference);
  const applyCurrentUserPreferences = useNotificationStore((state) => state.applyCurrentUserPreferences);

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [currentUserId, users],
  );

  const [emailForm, setEmailForm] = useState({
    email: currentUser?.email ?? '',
    currentPassword: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const section = new URLSearchParams(location.search).get('section');

  useEffect(() => {
    const token = new URLSearchParams(location.search).get('emailChangeToken');
    if (!token) return;

    const result = confirmEmailChange(token);
    setStatusMessage(result.message);
    navigate('/settings', { replace: true });
  }, [confirmEmailChange, location.search, navigate]);

  if (!currentUser) {
    return (
      <section className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5">
        <p className="text-sm text-[var(--muted)]">No active user session found.</p>
      </section>
    );
  }

  const isMainAdmin = currentUser.id === 'u-admin';

  function handleEmailSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const result = updateCurrentUserEmail(emailForm.email, emailForm.currentPassword);
    setStatusMessage(result.message);

    if (result.success) {
      setEmailForm((previous) => ({ ...previous, currentPassword: '' }));
    }
  }

  function handlePasswordSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setStatusMessage('New password and confirmation must match.');
      return;
    }

    const strongEnough =
      passwordForm.newPassword.length >= 8
      && /[a-z]/.test(passwordForm.newPassword)
      && /[A-Z]/.test(passwordForm.newPassword)
      && /\d/.test(passwordForm.newPassword)
      && /[^A-Za-z0-9]/.test(passwordForm.newPassword);

    if (!strongEnough) {
      setStatusMessage('Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.');
      return;
    }

    const result = updateCurrentUserPassword(passwordForm.currentPassword, passwordForm.newPassword);
    setStatusMessage(result.message);

    if (result.success) {
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    }
  }

  function handleNotificationPreferenceChange<K extends keyof UserNotificationPreferences>(
    key: K,
    value: UserNotificationPreferences[K],
  ): void {
    const result = updateCurrentUserNotificationPreference(key, value);
    setStatusMessage(result.message);
    if (result.success) {
      applyCurrentUserPreferences();
    }
  }

  const labelClass = 'text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-slate-300';
  const inputClass = 'w-full rounded-xl border border-white/15 bg-slate-950/55 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30';

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5">
        <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.08em] text-[var(--muted)]">User Settings</p>
        <h2 className="m-0 text-[1.35rem] font-extrabold text-[var(--ink)]">Account Settings</h2>
        <p className="mt-2 text-[0.9rem] leading-relaxed text-[var(--muted)]">Manage your notification preferences and account credentials.</p>
      </header>

      {statusMessage && (
        <p className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {statusMessage}
        </p>
      )}

      <section className={`rounded-2xl border bg-[var(--panel)] p-5 ${section === 'profile' ? 'border-cyan-500/45' : 'border-[var(--line)]'}`}>
        <div className="mb-3">
          <h3 className="m-0 text-[0.95rem] font-extrabold uppercase tracking-[0.07em] text-[var(--ink)]">Profile</h3>
          <p className="mt-1 text-[0.84rem] text-[var(--muted)]">Signed in as {currentUser.name} ({currentUser.role}).</p>
        </div>

        {isMainAdmin && (
          <p className="mb-3 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[0.82rem] text-amber-200">
            Email changes are disabled for the main admin account.
          </p>
        )}

        <form className="space-y-3" onSubmit={handleEmailSubmit}>
          <label className={labelClass} htmlFor="settings-email">Email</label>
          <input
            id="settings-email"
            type="email"
            className={inputClass}
            value={emailForm.email}
            onChange={(event) => setEmailForm((previous) => ({ ...previous, email: event.target.value }))}
            disabled={isMainAdmin}
            required
          />

          <label className={labelClass} htmlFor="settings-email-password">Current Password</label>
          <input
            id="settings-email-password"
            type="password"
            className={inputClass}
            value={emailForm.currentPassword}
            onChange={(event) => setEmailForm((previous) => ({ ...previous, currentPassword: event.target.value }))}
            autoComplete="current-password"
            disabled={isMainAdmin}
            required
          />

          <button type="submit" disabled={isMainAdmin} className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-cyan-400 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60">
            Send Email Confirmation
          </button>
        </form>
      </section>

      <section className={`rounded-2xl border bg-[var(--panel)] p-5 ${section === 'security' ? 'border-cyan-500/45' : 'border-[var(--line)]'}`}>
        <h3 className="m-0 text-[0.95rem] font-extrabold uppercase tracking-[0.07em] text-[var(--ink)]">Password</h3>
        {isMainAdmin && (
          <p className="mt-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[0.82rem] text-amber-200">
            Password changes are disabled for the main admin account.
          </p>
        )}
        <form className="mt-3 space-y-3" onSubmit={handlePasswordSubmit}>
          <label className={labelClass} htmlFor="settings-current-password">Current Password</label>
          <input
            id="settings-current-password"
            type="password"
            className={inputClass}
            value={passwordForm.currentPassword}
            onChange={(event) => setPasswordForm((previous) => ({ ...previous, currentPassword: event.target.value }))}
            autoComplete="current-password"
            disabled={isMainAdmin}
            required
          />

          <label className={labelClass} htmlFor="settings-new-password">New Password</label>
          <input
            id="settings-new-password"
            type="password"
            className={inputClass}
            value={passwordForm.newPassword}
            onChange={(event) => setPasswordForm((previous) => ({ ...previous, newPassword: event.target.value }))}
            autoComplete="new-password"
            disabled={isMainAdmin}
            required
          />

          <label className={labelClass} htmlFor="settings-confirm-password">Confirm New Password</label>
          <input
            id="settings-confirm-password"
            type="password"
            className={inputClass}
            value={passwordForm.confirmPassword}
            onChange={(event) => setPasswordForm((previous) => ({ ...previous, confirmPassword: event.target.value }))}
            autoComplete="new-password"
            disabled={isMainAdmin}
            required
          />

          <p className="text-[0.78rem] text-[var(--muted)]">
            Password must include at least 8 characters, uppercase, lowercase, number, and symbol.
          </p>

          <button type="submit" disabled={isMainAdmin} className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-cyan-400 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60">
            Update Password
          </button>
        </form>
      </section>

      <section className={`rounded-2xl border bg-[var(--panel)] p-5 ${section === 'preferences' ? 'border-cyan-500/45' : 'border-[var(--line)]'}`}>
        <h3 className="m-0 text-[0.95rem] font-extrabold uppercase tracking-[0.07em] text-[var(--ink)]">Notification Preferences</h3>
        <p className="mt-1 text-[0.84rem] text-[var(--muted)]">These preferences apply only to your account.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {preferenceRows.map((row) => (
            <label key={row.key} className="inline-flex items-center gap-2.5 rounded-lg border border-[var(--line)] px-3 py-2 text-[0.86rem] text-[var(--ink)]">
              <input
                type="checkbox"
                checked={currentUser.notificationPreferences[row.key]}
                onChange={(event) => handleNotificationPreferenceChange(row.key, event.target.checked)}
                className="h-4 w-4 rounded border-[var(--line)] bg-transparent accent-sky-400"
              />
              <span>{row.label}</span>
            </label>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label htmlFor="settings-autodismiss" className="text-[0.8rem] font-semibold text-[var(--muted)]">Auto-dismiss duration:</label>
          <select
            id="settings-autodismiss"
            value={String(currentUser.notificationPreferences.autoDismissMs)}
            onChange={(event) => handleNotificationPreferenceChange('autoDismissMs', Number(event.target.value))}
            className="rounded-md border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5 text-[0.8rem] text-[var(--ink)]"
          >
            <option value="0">Off</option>
            <option value="3000">3 seconds</option>
            <option value="5000">5 seconds</option>
            <option value="8000">8 seconds</option>
          </select>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.86rem] text-[var(--muted)]">Sign out from this account when you are done.</p>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
          >
            Log Out
          </button>
        </div>
      </section>
    </section>
  );
}
