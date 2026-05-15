import { FormEvent, MutableRefObject, useState } from 'react';
import { UserPageAccessEditor } from '@/components/users/UserPageAccessEditor';
import { NewUserFormState } from '@/components/users/userManagementTypes';
import { ASSIGNABLE_USER_ROLE_OPTIONS, type AssignableUserRole } from '@/stores/auth/authTypes';

interface UserCreateSectionProps {
  createdMessage: string | null;
  newUser: NewUserFormState;
  createUserSectionRef: MutableRefObject<HTMLElement | null>;
  labelClassName: string;
  inputClassName: string;
  checkboxClassName: string;
  onCreateUserSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onNewUserFieldChange: (field: keyof NewUserFormState, value: string) => void;
  onNewUserRoleChange: (role: AssignableUserRole) => void;
  onRegenerateTemporaryPassword: () => void;
}

export function UserCreateSection({
  createdMessage,
  newUser,
  createUserSectionRef,
  labelClassName,
  inputClassName,
  checkboxClassName,
  onCreateUserSubmit,
  onNewUserFieldChange,
  onNewUserRoleChange,
  onRegenerateTemporaryPassword,
}: UserCreateSectionProps) {
  const [showTemporaryPassword, setShowTemporaryPassword] = useState(false);

  return (
    <section ref={createUserSectionRef}>
      <h3 className="m-0 text-[0.95rem] font-extrabold uppercase tracking-[0.07em] text-[var(--ink)]">Create User</h3>
      <p className="mt-1 text-[0.84rem] text-[var(--muted)]">Provision a new user account with one fixed role access bundle.</p>
      <form onSubmit={onCreateUserSubmit} className="mt-4 flex flex-col gap-2.5">
        <label className={labelClassName} htmlFor="new-user-name">Name</label>
        <input
          id="new-user-name"
          name="new-user-name"
          className={inputClassName}
          value={newUser.name}
          onChange={(event) => onNewUserFieldChange('name', event.target.value)}
          autoComplete="name"
          required
        />

        <label className={`${labelClassName} mt-2`} htmlFor="new-user-email">Email</label>
        <input
          id="new-user-email"
          name="new-user-email"
          className={inputClassName}
          type="email"
          value={newUser.email}
          onChange={(event) => onNewUserFieldChange('email', event.target.value)}
          autoComplete="email"
          required
        />

        <label className={`${labelClassName} mt-2`} htmlFor="new-user-password">Temporary Password</label>
        <input
          id="new-user-password"
          name="new-user-password"
          className={inputClassName}
          type={showTemporaryPassword ? 'text' : 'password'}
          value={newUser.password}
          onChange={(event) => onNewUserFieldChange('password', event.target.value)}
          autoComplete="new-password"
          required
        />
        <div className="mt-1 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-white/10"
            onClick={() => setShowTemporaryPassword((value) => !value)}
          >
            {showTemporaryPassword ? 'Hide password' : 'Reveal password'}
          </button>
          <button
            type="button"
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-white/10"
            onClick={onRegenerateTemporaryPassword}
          >
            Regenerate password
          </button>
        </div>

        <label className={`${labelClassName} mt-2`} htmlFor="new-user-role">Role</label>
        <select
          id="new-user-role"
          name="new-user-role"
          className={inputClassName}
          value={newUser.role}
          onChange={(event) => onNewUserRoleChange(event.target.value as AssignableUserRole)}
        >
          {ASSIGNABLE_USER_ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        {newUser.role !== 'admin' && (
          <div className="mt-2">
            <p className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-slate-300">Role Access</p>
            <UserPageAccessEditor
              userRole={newUser.role}
              selectedPages={newUser.allowedPages}
              checkboxClassName={checkboxClassName}
              disabled
              onTogglePage={() => undefined}
            />
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">Each user can have one role only. Change the role selector to switch the bundled access.</p>
          </div>
        )}

        <button type="submit" className="mt-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-cyan-400 hover:to-blue-400">Create User</button>
        {createdMessage && <p className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{createdMessage}</p>}
      </form>
    </section>
  );
}