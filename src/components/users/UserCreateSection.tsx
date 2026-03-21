import { FormEvent, MutableRefObject } from 'react';
import { ASSIGNABLE_PAGES, AppPage, PAGE_DEFINITIONS } from '@/auth/pages';
import { NewUserFormState } from '@/components/users/userManagementTypes';

interface UserCreateSectionProps {
  createdMessage: string | null;
  newUser: NewUserFormState;
  createUserSectionRef: MutableRefObject<HTMLElement | null>;
  labelClassName: string;
  inputClassName: string;
  checkboxClassName: string;
  onCreateUserSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onNewUserFieldChange: (field: keyof NewUserFormState, value: string) => void;
  onNewUserRoleChange: (role: 'admin' | 'user') => void;
  onNewUserPageToggle: (page: AppPage) => void;
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
  onNewUserPageToggle,
}: UserCreateSectionProps) {
  return (
    <section ref={createUserSectionRef}>
      <h3 className="m-0 text-[0.95rem] font-extrabold uppercase tracking-[0.07em] text-[var(--ink)]">Create User</h3>
      <p className="mt-1 text-[0.84rem] text-[var(--muted)]">Provision a new user account and page access.</p>
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
          type="password"
          value={newUser.password}
          onChange={(event) => onNewUserFieldChange('password', event.target.value)}
          autoComplete="new-password"
          required
        />

        <label className={`${labelClassName} mt-2`} htmlFor="new-user-role">Role</label>
        <select
          id="new-user-role"
          name="new-user-role"
          className={inputClassName}
          value={newUser.role}
          onChange={(event) => onNewUserRoleChange(event.target.value === 'admin' ? 'admin' : 'user')}
        >
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>

        {newUser.role === 'user' && (
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ASSIGNABLE_PAGES.map((page) => (
              <label key={`new-${page}`} className="inline-flex items-center gap-2 text-sm text-[var(--ink)]">
                <input
                  type="checkbox"
                  className={checkboxClassName}
                  checked={newUser.allowedPages.includes(page)}
                  onChange={() => onNewUserPageToggle(page)}
                />
                <span>{PAGE_DEFINITIONS[page].label}</span>
              </label>
            ))}
          </div>
        )}

        <button type="submit" className="mt-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-cyan-400 hover:to-blue-400">Create User</button>
        {createdMessage && <p className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{createdMessage}</p>}
      </form>
    </section>
  );
}