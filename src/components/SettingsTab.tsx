import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageTitleHeader } from '@/components/app/PageTitleHeader';
import { SectionSubnav } from '@/components/app/SectionSubnav';
import { getRuntimeHealthReport, type RuntimeHealthEntry } from '@/config/runtimeHealth';
import { useAuthStore } from '@/stores/auth/authStore';
import { PASSWORD_POLICY_MESSAGE, validatePasswordPolicy } from '@/stores/auth/passwordPolicy';
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

type SettingsSectionKey = 'profile' | 'security' | 'preferences' | 'runtime' | 'session';

const settingsSections: Array<{ key: SettingsSectionKey; label: string; detail: string }> = [
  { key: 'profile', label: 'Profile', detail: 'Email and account identity' },
  { key: 'security', label: 'Password', detail: 'Credential and sign-in security' },
  { key: 'preferences', label: 'Notifications', detail: 'Notification tone and timing' },
  { key: 'runtime', label: 'Runtime', detail: 'Public config and feature wiring' },
  { key: 'session', label: 'Session', detail: 'Sign out controls' },
];

const runtimeStatusClasses: Record<RuntimeHealthEntry['status'], string> = {
  ok: 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200',
  warning: 'border-amber-400/35 bg-amber-500/10 text-amber-200',
  missing: 'border-rose-400/35 bg-rose-500/10 text-rose-200',
};

export function SettingsTab() {
  const users = useAuthStore((state) => state.users);
  const currentUserId = useAuthStore((state) => state.currentUserId);
  const requiresPasswordChange = useAuthStore((state) => state.requiresPasswordChange);
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
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showSecurityPasswords, setShowSecurityPasswords] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const section = new URLSearchParams(location.search).get('section') as SettingsSectionKey | null;
  const [activeSection, setActiveSection] = useState<SettingsSectionKey>(section ?? 'profile');
  const profileSectionRef = useRef<HTMLElement | null>(null);
  const securitySectionRef = useRef<HTMLElement | null>(null);
  const preferencesSectionRef = useRef<HTMLElement | null>(null);
  const runtimeSectionRef = useRef<HTMLElement | null>(null);
  const sessionSectionRef = useRef<HTMLElement | null>(null);
  const runtimeHealth = useMemo(() => getRuntimeHealthReport(), []);

  useEffect(() => {
    const token = new URLSearchParams(location.search).get('emailChangeToken');
    if (!token) return;

    void (async () => {
      const result = await confirmEmailChange(token);
      setStatusMessage(result.message);
      navigate('/account/settings', { replace: true });
    })();
  }, [confirmEmailChange, location.search, navigate]);

  useEffect(() => {
    if (!section) {
      setActiveSection('profile');
      return;
    }

    const sectionRefMap: Record<SettingsSectionKey, React.RefObject<HTMLElement | null>> = {
      profile: profileSectionRef,
      security: securitySectionRef,
      preferences: preferencesSectionRef,
      runtime: runtimeSectionRef,
      session: sessionSectionRef,
    };
    const target = sectionRefMap[section]?.current;
    if (!target) return;

    setActiveSection(section);

    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [section]);

  if (!currentUser) {
    return (
      <section className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5">
        <p className="text-sm text-[var(--muted)]">No active user session found.</p>
      </section>
    );
  }

  const isMainAdmin = currentUser.id === 'u-admin';

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const result = await updateCurrentUserEmail(emailForm.email, emailForm.currentPassword);
    setStatusMessage(result.message);

    if (result.success) {
      setEmailForm((previous) => ({ ...previous, currentPassword: '' }));
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setStatusMessage('New password and confirmation must match.');
      return;
    }

    const passwordPolicyError = validatePasswordPolicy(passwordForm.newPassword);
    if (passwordPolicyError) {
      setStatusMessage(passwordPolicyError);
      return;
    }

    const result = await updateCurrentUserPassword(passwordForm.currentPassword, passwordForm.newPassword);
    setStatusMessage(result.message);

    if (result.success) {
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    }
  }

  async function handleNotificationPreferenceChange<K extends keyof UserNotificationPreferences>(
    key: K,
    value: UserNotificationPreferences[K],
  ): Promise<void> {
    const result = await updateCurrentUserNotificationPreference(key, value);
    setStatusMessage(result.message);
    if (result.success) {
      applyCurrentUserPreferences();
    }
  }

  const labelClass = 'text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-slate-300';
  const inputClass = 'w-full rounded-xl border border-white/15 bg-slate-950/55 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30';
  const revealButtonClass = 'shrink-0 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-white/10';

  function navigateToSection(targetSection: SettingsSectionKey): void {
    setActiveSection(targetSection);
    const params = new URLSearchParams(location.search);
    params.set('section', targetSection);
    navigate({ pathname: '/account/settings', search: `?${params.toString()}` }, { replace: false });
  }

  return (
    <section className="space-y-5">
      <PageTitleHeader
        title="Account Settings"
        description="Manage your notification preferences and account credentials."
      />

      {requiresPasswordChange && (
        <p className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          You must update your temporary password before continuing.
        </p>
      )}

      {statusMessage && (
        <p className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {statusMessage}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <SectionSubnav
          ariaLabel="Settings sections"
          items={settingsSections}
          onSelect={navigateToSection}
        />

        <div className="space-y-5">
          <section
            id="settings-section-profile"
            ref={profileSectionRef}
            className={`scroll-mt-20 rounded-2xl border bg-[var(--panel)] p-5 ${activeSection === 'profile' ? 'border-cyan-500/45' : 'border-[var(--line)]'}`}
          >
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

              <div className="flex items-center justify-between gap-3">
                <label className={labelClass} htmlFor="settings-email-password">Current Password</label>
                <button
                  type="button"
                  className={revealButtonClass}
                  aria-controls="settings-email-password"
                  aria-pressed={showEmailPassword}
                  onClick={() => setShowEmailPassword((value) => !value)}
                >
                  {showEmailPassword ? 'Hide' : 'Reveal'}
                </button>
              </div>
              <input
                id="settings-email-password"
                type={showEmailPassword ? 'text' : 'password'}
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

          <section
            id="settings-section-security"
            ref={securitySectionRef}
            className={`scroll-mt-20 rounded-2xl border bg-[var(--panel)] p-5 ${activeSection === 'security' ? 'border-cyan-500/45' : 'border-[var(--line)]'}`}
          >
            <h3 className="m-0 text-[0.95rem] font-extrabold uppercase tracking-[0.07em] text-[var(--ink)]">Password</h3>
            {isMainAdmin && (
              <p className="mt-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[0.82rem] text-amber-200">
                Password changes are disabled for the main admin account.
              </p>
            )}
            <form className="mt-3 space-y-3" onSubmit={handlePasswordSubmit}>
              <div className="flex items-center justify-between gap-3">
                <label className={labelClass} htmlFor="settings-current-password">Current Password</label>
                <button
                  type="button"
                  className={revealButtonClass}
                  aria-controls="settings-current-password settings-new-password settings-confirm-password"
                  aria-pressed={showSecurityPasswords}
                  onClick={() => setShowSecurityPasswords((value) => !value)}
                >
                  {showSecurityPasswords ? 'Hide' : 'Reveal'}
                </button>
              </div>
              <input
                id="settings-current-password"
                type={showSecurityPasswords ? 'text' : 'password'}
                className={inputClass}
                value={passwordForm.currentPassword}
                onChange={(event) => setPasswordForm((previous) => ({ ...previous, currentPassword: event.target.value }))}
                autoComplete="current-password"
                disabled={isMainAdmin}
                required
              />

              <div className="flex items-center justify-between gap-3">
                <label className={labelClass} htmlFor="settings-new-password">New Password</label>
                <button
                  type="button"
                  className={revealButtonClass}
                  aria-controls="settings-current-password settings-new-password settings-confirm-password"
                  aria-pressed={showSecurityPasswords}
                  onClick={() => setShowSecurityPasswords((value) => !value)}
                >
                  {showSecurityPasswords ? 'Hide' : 'Reveal'}
                </button>
              </div>
              <input
                id="settings-new-password"
                type={showSecurityPasswords ? 'text' : 'password'}
                className={inputClass}
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm((previous) => ({ ...previous, newPassword: event.target.value }))}
                autoComplete="new-password"
                disabled={isMainAdmin}
                required
              />

              <div className="flex items-center justify-between gap-3">
                <label className={labelClass} htmlFor="settings-confirm-password">Confirm New Password</label>
                <button
                  type="button"
                  className={revealButtonClass}
                  aria-controls="settings-current-password settings-new-password settings-confirm-password"
                  aria-pressed={showSecurityPasswords}
                  onClick={() => setShowSecurityPasswords((value) => !value)}
                >
                  {showSecurityPasswords ? 'Hide' : 'Reveal'}
                </button>
              </div>
              <input
                id="settings-confirm-password"
                type={showSecurityPasswords ? 'text' : 'password'}
                className={inputClass}
                value={passwordForm.confirmPassword}
                onChange={(event) => setPasswordForm((previous) => ({ ...previous, confirmPassword: event.target.value }))}
                autoComplete="new-password"
                disabled={isMainAdmin}
                required
              />

              <p className="text-[0.78rem] text-[var(--muted)]">
                {PASSWORD_POLICY_MESSAGE}
              </p>

              <button type="submit" disabled={isMainAdmin} className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-cyan-400 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60">
                Update Password
              </button>
            </form>
          </section>

          <section
            id="settings-section-preferences"
            ref={preferencesSectionRef}
            className={`scroll-mt-20 rounded-2xl border bg-[var(--panel)] p-5 ${activeSection === 'preferences' ? 'border-cyan-500/45' : 'border-[var(--line)]'}`}
          >
            <h3 className="m-0 text-[0.95rem] font-extrabold uppercase tracking-[0.07em] text-[var(--ink)]">Notification Preferences</h3>
            <p className="mt-1 text-[0.84rem] text-[var(--muted)]">These preferences apply only to your account.</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {preferenceRows.map((row) => (
                <label key={row.key} className="inline-flex items-center gap-2.5 rounded-lg border border-[var(--line)] px-3 py-2 text-[0.86rem] text-[var(--ink)]">
                  <input
                    type="checkbox"
                    checked={currentUser.notificationPreferences[row.key]}
                    onChange={(event) => {
                      void handleNotificationPreferenceChange(row.key, event.target.checked);
                    }}
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
                onChange={(event) => {
                  void handleNotificationPreferenceChange('autoDismissMs', Number(event.target.value));
                }}
                className="rounded-md border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5 text-[0.8rem] text-[var(--ink)]"
              >
                <option value="0">Off</option>
                <option value="3000">3 seconds</option>
                <option value="5000">5 seconds</option>
                <option value="8000">8 seconds</option>
              </select>
            </div>
          </section>

          <section
            id="settings-section-runtime"
            ref={runtimeSectionRef}
            className={`scroll-mt-20 rounded-2xl border bg-[var(--panel)] p-5 ${activeSection === 'runtime' ? 'border-cyan-500/45' : 'border-[var(--line)]'}`}
          >
            <h3 className="m-0 text-[0.95rem] font-extrabold uppercase tracking-[0.07em] text-[var(--ink)]">Runtime Config Health</h3>
            <p className="mt-1 text-[0.84rem] text-[var(--muted)]">Review which browser-safe settings are loaded, which ones are missing, and which feature surfaces may degrade.</p>

            <div className="mt-4 rounded-xl border border-[var(--line)] bg-black/15 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.08em] ${runtimeStatusClasses[runtimeHealth.configSource.status === 'loaded' ? 'ok' : runtimeHealth.configSource.status === 'idle' ? 'warning' : 'missing']}`}>
                  {runtimeHealth.configSource.status}
                </span>
                <span className="text-sm font-semibold text-[var(--ink)]">Runtime config source</span>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">{runtimeHealth.configSource.message}</p>
            </div>

            <div className="mt-4 grid gap-3">
              {runtimeHealth.entries.map((entry) => (
                <div key={entry.label} className="rounded-xl border border-[var(--line)] bg-[var(--bg)]/55 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--ink)]">{entry.label}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] ${runtimeStatusClasses[entry.status]}`}>
                      {entry.status}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-slate-300">
                      {entry.requirement}
                    </span>
                  </div>
                  <p className="mt-2 text-[0.84rem] leading-6 text-[var(--muted)]">{entry.detail}</p>
                  <p className="mt-2 text-[0.78rem] text-slate-300">
                    Current value: {entry.value ?? 'Not set'}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section
            id="settings-section-session"
            ref={sessionSectionRef}
            className={`scroll-mt-20 rounded-2xl border bg-[var(--panel)] p-5 ${activeSection === 'session' ? 'border-cyan-500/45' : 'border-[var(--line)]'}`}
          >
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
        </div>
      </div>
    </section>
  );
}
