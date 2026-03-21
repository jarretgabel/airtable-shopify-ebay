import { FormEvent, useMemo, useRef, useState } from 'react';
import { AppPage, PAGE_DEFINITIONS } from '@/auth/pages';
import { useAuth } from '@/stores/auth/authStore';
import type { AppUser } from '@/stores/auth/authTypes';
import { UserDetailPanel } from '@/components/users/UserDetailPanel';
import { UserDirectoryPanel } from '@/components/users/UserDirectoryPanel';
import { NewUserFormState, RoleFilter, UserSortKey } from '@/components/users/userManagementTypes';

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
      <UserDetailPanel
        selectedUser={selectedUser}
        statusMessage={statusMessage}
        labelClassName={labelClassName}
        inputClassName={inputClassName}
        checkboxClassName={checkboxClassName}
        roleBadgeClassName={roleBadgeClassName}
        onBackToList={onBackToList}
        onRoleChange={(role) => updateUserRole(selectedUser.id, role)}
        onTogglePermission={(page) => togglePermission(selectedUser, page)}
        onSendPasswordReset={() => handleReset(selectedUser.email)}
      />
    );
  }

  return (
    <UserDirectoryPanel
      statusMessage={statusMessage}
      createdMessage={createdMessage}
      sortedUsers={sortedUsers}
      listUsers={listUsers}
      searchTerm={searchTerm}
      roleFilter={roleFilter}
      sortKey={sortKey}
      sortDirection={sortDirection}
      newUser={newUser}
      labelClassName={labelClassName}
      inputClassName={inputClassName}
      checkboxClassName={checkboxClassName}
      roleBadgeClassName={roleBadgeClassName}
      formatAccessiblePages={formatAccessiblePages}
      createUserSectionRef={createUserSectionRef}
      onSearchTermChange={setSearchTerm}
      onRoleFilterChange={setRoleFilter}
      onSortKeyChange={setSortKey}
      onSortDirectionChange={setSortDirection}
      onSelectUser={onSelectUser}
      onCreateUserSubmit={handleCreateUser}
      onScrollToCreateUser={scrollToCreateUserSection}
      onNewUserFieldChange={(field, value) => setNewUser((previous) => ({ ...previous, [field]: value }))}
      onNewUserRoleChange={(role) => setNewUser((previous) => ({ ...previous, role }))}
      onNewUserPageToggle={handleNewUserPageToggle}
    />
  );
}
