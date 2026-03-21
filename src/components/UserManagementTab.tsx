import { FormEvent, useMemo, useRef, useState } from 'react';
import { ASSIGNABLE_PAGES, AppPage, PAGE_DEFINITIONS } from '@/auth/pages';
import { AppUser, useAuth } from '@/context/AuthContext';

interface NewUserFormState {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
  allowedPages: AppPage[];
}

function defaultFormState(): NewUserFormState {
  return {
    name: '',
    email: '',
    password: '',
    role: 'user',
    allowedPages: ['dashboard'],
  };
}

interface UserManagementTabProps {
  selectedUserId: string | null;
  onSelectUser: (userId: string) => void;
  onBackToList: () => void;
}

type RoleFilter = 'all' | 'admin' | 'user';
type UserSortKey = 'name' | 'email' | 'role' | 'pages';

function roleBadgeClassName(role: AppUser['role']): string {
  return role === 'admin'
    ? 'inline-flex rounded-full bg-cyan-500/20 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300'
    : 'inline-flex rounded-full bg-slate-500/20 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300';
}

function formatAccessiblePages(user: AppUser): string {
  if (user.role === 'admin') {
    return 'All pages';
  }

  return user.allowedPages.map((page) => PAGE_DEFINITIONS[page].label).join(', ') || 'No pages assigned';
}

export function UserManagementTab({ selectedUserId, onSelectUser, onBackToList }: UserManagementTabProps) {
  const { users, updateUserPermissions, updateUserRole, requestPasswordReset, createUser } = useAuth();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [createdMessage, setCreatedMessage] = useState<string | null>(null);
  const [newUser, setNewUser] = useState<NewUserFormState>(() => defaultFormState());
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [sortKey, setSortKey] = useState<UserSortKey>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const createUserSectionRef = useRef<HTMLElement>(null);

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.email.localeCompare(b.email)),
    [users],
  );

  const listUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const filtered = sortedUsers.filter((user) => {
      const roleMatches = roleFilter === 'all' || user.role === roleFilter;
      if (!roleMatches) return false;

      if (!normalizedSearch) return true;

      const pageText = formatAccessiblePages(user).toLowerCase();
      return (
        user.name.toLowerCase().includes(normalizedSearch)
        || user.email.toLowerCase().includes(normalizedSearch)
        || pageText.includes(normalizedSearch)
      );
    });

    const direction = sortDirection === 'asc' ? 1 : -1;

    return filtered.sort((a, b) => {
      const aPages = a.role === 'admin' ? Number.MAX_SAFE_INTEGER : a.allowedPages.length;
      const bPages = b.role === 'admin' ? Number.MAX_SAFE_INTEGER : b.allowedPages.length;

      const aValue =
        sortKey === 'name'
          ? a.name.toLowerCase()
          : sortKey === 'email'
            ? a.email.toLowerCase()
            : sortKey === 'role'
              ? a.role
              : aPages;
      const bValue =
        sortKey === 'name'
          ? b.name.toLowerCase()
          : sortKey === 'email'
            ? b.email.toLowerCase()
            : sortKey === 'role'
              ? b.role
              : bPages;

      if (aValue < bValue) return -1 * direction;
      if (aValue > bValue) return 1 * direction;
      return 0;
    });
  }, [searchTerm, roleFilter, sortKey, sortDirection, sortedUsers]);

  function togglePermission(user: AppUser, page: AppPage): void {
    if (user.role === 'admin') return;

    const hasPage = user.allowedPages.includes(page);
    const nextPages = hasPage
      ? user.allowedPages.filter((value) => value !== page)
      : [...user.allowedPages, page];

    updateUserPermissions(user.id, nextPages);
  }

  function handleReset(email: string): void {
    const result = requestPasswordReset(email);
    setStatusMessage(result.message);
  }

  function handleCreateUser(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const result = createUser(newUser);
    setCreatedMessage(result.message);
    if (result.success) {
      setNewUser(defaultFormState());
    }
  }

  function handleNewUserPageToggle(page: AppPage): void {
    const hasPage = newUser.allowedPages.includes(page);
    const allowedPages = hasPage
      ? newUser.allowedPages.filter((value) => value !== page)
      : [...newUser.allowedPages, page];

    setNewUser((previous) => ({ ...previous, allowedPages }));
  }

  function scrollToCreateUserSection(): void {
    createUserSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const labelClassName = 'text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-slate-300';
  const inputClassName = 'w-full rounded-xl border border-white/15 bg-slate-950/55 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30';
  const checkboxClassName = 'h-4 w-4 rounded border-white/20 bg-slate-950/55 text-cyan-500 focus:ring-cyan-500/40 disabled:opacity-60';

  const selectedUser = selectedUserId
    ? sortedUsers.find((user) => user.id === selectedUserId) ?? null
    : null;

  if (selectedUserId && !selectedUser) {
    return (
      <section className="mt-3 rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-4">
        <p className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">User not found.</p>
        <button
          type="button"
          className="mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
          onClick={onBackToList}
        >
          Back to Users List
        </button>
      </section>
    );
  }

  if (selectedUser) {
    return (
      <section className="mt-3 rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <button
            type="button"
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
            onClick={onBackToList}
          >
            Back to Users List
          </button>
          <div>
            <p className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-slate-300">User Detail</p>
            <h2 className="m-0 mt-1 text-xl font-semibold text-[var(--ink)]">{selectedUser.name}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{selectedUser.email}</p>
          </div>
          <span className={roleBadgeClassName(selectedUser.role)}>{selectedUser.role}</span>
        </div>

        {statusMessage && <p className="mb-4 rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{statusMessage}</p>}

        <article className="flex flex-col gap-4 rounded-2xl border border-white/15 bg-slate-950/45 p-4 shadow-[0_12px_26px_rgba(0,0,0,0.28)]">
          <div>
            <p className="m-0 text-xs uppercase tracking-[0.12em] text-slate-300">User ID</p>
            <p className="mt-1 font-mono text-sm text-slate-200">{selectedUser.id}</p>
          </div>

          <label className={labelClassName} htmlFor={`role-${selectedUser.id}`}>Role</label>
          <select
            id={`role-${selectedUser.id}`}
            className={inputClassName}
            value={selectedUser.role}
            onChange={(event) => updateUserRole(selectedUser.id, event.target.value === 'admin' ? 'admin' : 'user')}
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>

          <div>
            <p className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-slate-300">Accessible Pages</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ASSIGNABLE_PAGES.map((page) => (
                <label key={`${selectedUser.id}-${page}`} className="inline-flex items-center gap-2 text-sm text-[var(--ink)]">
                  <input
                    type="checkbox"
                    className={checkboxClassName}
                    checked={selectedUser.role === 'admin' ? true : selectedUser.allowedPages.includes(page)}
                    disabled={selectedUser.role === 'admin'}
                    onChange={() => togglePermission(selectedUser, page)}
                  />
                  <span>{PAGE_DEFINITIONS[page].label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
            onClick={() => handleReset(selectedUser.email)}
          >
            Send Password Reset Email
          </button>
        </article>
      </section>
    );
  }

  return (
    <section className="mt-3 rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="m-0 text-xl font-semibold text-[var(--ink)]">User Management</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Admins can manage users in a table list and open each profile in its own URL.</p>
        </div>
        <button
          type="button"
          className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-cyan-400 hover:to-blue-400"
          onClick={scrollToCreateUserSection}
        >
          Create User
        </button>
      </div>

      {statusMessage && <p className="mb-4 rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{statusMessage}</p>}

      <section className="rounded-2xl border border-white/15 bg-slate-950/45 p-4 shadow-[0_12px_26px_rgba(0,0,0,0.28)]">
        <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-4">
          <label className="flex flex-col gap-1.5 lg:col-span-2">
            <span className={labelClassName}>Search</span>
            <input
              type="text"
              className={inputClassName}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name, email, or pages"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={labelClassName}>Role Filter</span>
            <select
              className={inputClassName}
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
          </label>

          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className={labelClassName}>Sort By</span>
              <select
                className={inputClassName}
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as UserSortKey)}
              >
                <option value="name">Name</option>
                <option value="email">Email</option>
                <option value="role">Role</option>
                <option value="pages">Accessible Pages</option>
              </select>
            </label>

            <label className="flex w-[6.5rem] flex-col gap-1.5">
              <span className={labelClassName}>Order</span>
              <select
                className={inputClassName}
                value={sortDirection}
                onChange={(event) => setSortDirection(event.target.value as 'asc' | 'desc')}
              >
                <option value="asc">Asc</option>
                <option value="desc">Desc</option>
              </select>
            </label>
          </div>
        </div>

        <p className="mb-3 text-xs text-slate-300">
          Showing <strong>{listUsers.length}</strong> of <strong>{sortedUsers.length}</strong> users
        </p>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-white/15 px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-300">Name</th>
                <th className="border-b border-white/15 px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-300">Email</th>
                <th className="border-b border-white/15 px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-300">Role</th>
                <th className="border-b border-white/15 px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-300">Accessible Pages</th>
                <th className="border-b border-white/15 px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {listUsers.map((user) => (
                <tr key={user.id} className="hover:bg-white/5 transition">
                  <td className="border-b border-white/10 px-3 py-2.5 text-[var(--ink)] font-medium">{user.name}</td>
                  <td className="border-b border-white/10 px-3 py-2.5 text-[var(--muted)]">{user.email}</td>
                  <td className="border-b border-white/10 px-3 py-2.5"><span className={roleBadgeClassName(user.role)}>{user.role}</span></td>
                  <td className="border-b border-white/10 px-3 py-2.5 text-[var(--muted)] max-w-[380px]">{formatAccessiblePages(user)}</td>
                  <td className="border-b border-white/10 px-3 py-2.5">
                    <button
                      type="button"
                      className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-white/10"
                      onClick={() => onSelectUser(user.id)}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
              {listUsers.length === 0 && (
                <tr>
                  <td className="px-3 py-5 text-center text-sm text-slate-300" colSpan={5}>
                    No users match the current search/filter options.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section ref={createUserSectionRef} className="mt-6 border-t border-[var(--line)] pt-5">
        <h3 className="m-0 text-xl font-semibold text-[var(--ink)]">Create User</h3>
        <form onSubmit={handleCreateUser} className="mt-4 flex flex-col gap-2.5">
          <label className={labelClassName} htmlFor="new-user-name">Name</label>
          <input
            id="new-user-name"
            name="new-user-name"
            className={inputClassName}
            value={newUser.name}
            onChange={(event) => setNewUser((previous) => ({ ...previous, name: event.target.value }))}
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
            onChange={(event) => setNewUser((previous) => ({ ...previous, email: event.target.value }))}
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
            onChange={(event) => setNewUser((previous) => ({ ...previous, password: event.target.value }))}
            autoComplete="new-password"
            required
          />

          <label className={`${labelClassName} mt-2`} htmlFor="new-user-role">Role</label>
          <select
            id="new-user-role"
            name="new-user-role"
            className={inputClassName}
            value={newUser.role}
            onChange={(event) => setNewUser((previous) => ({
              ...previous,
              role: event.target.value === 'admin' ? 'admin' : 'user',
            }))}
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
                    onChange={() => handleNewUserPageToggle(page)}
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
    </section>
  );
}
