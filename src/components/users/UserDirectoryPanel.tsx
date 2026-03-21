import { FormEvent, MutableRefObject } from 'react';
import { AppPage } from '@/auth/pages';
import { AppUser } from '@/context/AuthContext';
import { UserCreateSection } from '@/components/users/UserCreateSection';
import { UserDirectoryListSection } from '@/components/users/UserDirectoryListSection';
import { NewUserFormState, RoleFilter, UserSortKey } from '@/components/users/userManagementTypes';

interface UserDirectoryPanelProps {
  statusMessage: string | null;
  createdMessage: string | null;
  sortedUsers: AppUser[];
  listUsers: AppUser[];
  searchTerm: string;
  roleFilter: RoleFilter;
  sortKey: UserSortKey;
  sortDirection: 'asc' | 'desc';
  newUser: NewUserFormState;
  labelClassName: string;
  inputClassName: string;
  checkboxClassName: string;
  roleBadgeClassName: (role: AppUser['role']) => string;
  formatAccessiblePages: (user: AppUser) => string;
  createUserSectionRef: MutableRefObject<HTMLElement | null>;
  onSearchTermChange: (value: string) => void;
  onRoleFilterChange: (value: RoleFilter) => void;
  onSortKeyChange: (value: UserSortKey) => void;
  onSortDirectionChange: (value: 'asc' | 'desc') => void;
  onSelectUser: (userId: string) => void;
  onCreateUserSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onScrollToCreateUser: () => void;
  onNewUserFieldChange: (field: keyof NewUserFormState, value: string) => void;
  onNewUserRoleChange: (role: 'admin' | 'user') => void;
  onNewUserPageToggle: (page: AppPage) => void;
}

export function UserDirectoryPanel({
  statusMessage,
  createdMessage,
  sortedUsers,
  listUsers,
  searchTerm,
  roleFilter,
  sortKey,
  sortDirection,
  newUser,
  labelClassName,
  inputClassName,
  checkboxClassName,
  roleBadgeClassName,
  formatAccessiblePages,
  createUserSectionRef,
  onSearchTermChange,
  onRoleFilterChange,
  onSortKeyChange,
  onSortDirectionChange,
  onSelectUser,
  onCreateUserSubmit,
  onScrollToCreateUser,
  onNewUserFieldChange,
  onNewUserRoleChange,
  onNewUserPageToggle,
}: UserDirectoryPanelProps) {
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
          onClick={onScrollToCreateUser}
        >
          Create User
        </button>
      </div>

      {statusMessage && <p className="mb-4 rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{statusMessage}</p>}

      <UserDirectoryListSection
        sortedUsers={sortedUsers}
        listUsers={listUsers}
        searchTerm={searchTerm}
        roleFilter={roleFilter}
        sortKey={sortKey}
        sortDirection={sortDirection}
        labelClassName={labelClassName}
        inputClassName={inputClassName}
        roleBadgeClassName={roleBadgeClassName}
        formatAccessiblePages={formatAccessiblePages}
        onSearchTermChange={onSearchTermChange}
        onRoleFilterChange={onRoleFilterChange}
        onSortKeyChange={onSortKeyChange}
        onSortDirectionChange={onSortDirectionChange}
        onSelectUser={onSelectUser}
      />

      <UserCreateSection
        createdMessage={createdMessage}
        newUser={newUser}
        createUserSectionRef={createUserSectionRef}
        labelClassName={labelClassName}
        inputClassName={inputClassName}
        checkboxClassName={checkboxClassName}
        onCreateUserSubmit={onCreateUserSubmit}
        onNewUserFieldChange={onNewUserFieldChange}
        onNewUserRoleChange={onNewUserRoleChange}
        onNewUserPageToggle={onNewUserPageToggle}
      />
    </section>
  );
}
