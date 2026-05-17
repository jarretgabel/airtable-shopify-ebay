import { FormEvent, MutableRefObject, useRef, useState } from 'react';
import { AppSectionTitle } from '@/components/app/AppSectionTitle';
import { MainPageSectionNav } from '@/components/app/MainPageSectionNav';
import { PageTitleHeader } from '@/components/app/PageTitleHeader';
import { RoleNotificationDefaultsPanel } from '@/components/users/RoleNotificationDefaultsPanel';
import type { AppUser } from '@/stores/auth/authTypes';
import type { AssignableUserRole } from '@/stores/auth/authTypes';
import type { UsedGearWorkflowNotificationEvent, UserRole } from '@/stores/auth/authTypes';
import { UserCreateSection } from '@/components/users/UserCreateSection';
import { UserDirectoryListSection } from '@/components/users/UserDirectoryListSection';
import { NewUserFormState, RoleFilter, UserSortKey } from '@/components/users/userManagementTypes';
import type { RoleWorkflowNotificationDefaults } from '@/services/roleNotificationDefaults';

type UserManagementSection = 'overview' | 'directory' | 'create';

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
  roleNotificationDefaults: RoleWorkflowNotificationDefaults;
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
  onNewUserRoleChange: (role: AssignableUserRole) => void;
  onRegenerateTemporaryPassword: () => void;
  onToggleRoleWorkflowNotificationDefault: (role: UserRole, eventKey: UsedGearWorkflowNotificationEvent, enabled: boolean) => void;
  onApplyRoleWorkflowNotificationDefaults: (role: UserRole) => void;
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
  roleNotificationDefaults,
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
  onRegenerateTemporaryPassword,
  onToggleRoleWorkflowNotificationDefault,
  onApplyRoleWorkflowNotificationDefaults,
}: UserDirectoryPanelProps) {
  const [activeSection, setActiveSection] = useState<UserManagementSection | null>(null);
  const overviewSectionRef = useRef<HTMLElement | null>(null);
  const directorySectionRef = useRef<HTMLElement | null>(null);

  function scrollToSection(section: UserManagementSection): void {
    setActiveSection(section);
    if (section === 'overview') {
      overviewSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (section === 'directory') {
      directorySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    onScrollToCreateUser();
  }

  return (
    <section className="space-y-5">
      <section
        ref={overviewSectionRef}
        className="scroll-mt-20"
      >
        <PageTitleHeader
          eyebrow="User"
          title="User Management"
          actions={(
            <button
              type="button"
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-cyan-400 hover:to-blue-400"
              onClick={() => scrollToSection('create')}
            >
              Create User
            </button>
          )}
        />

        {statusMessage && <p className="mt-3 rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{statusMessage}</p>}
      </section>

      <MainPageSectionNav
        ariaLabel="User management sections"
        items={[
          { key: 'directory', label: 'User Directory' },
          { key: 'create', label: 'Create User' },
        ]}
        activeKey={activeSection ?? 'directory'}
        onSelect={scrollToSection}
      />

      <div className="space-y-5">
          <RoleNotificationDefaultsPanel
            roleNotificationDefaults={roleNotificationDefaults}
            checkboxClassName={checkboxClassName}
            onToggleRoleWorkflowNotificationDefault={onToggleRoleWorkflowNotificationDefault}
            onApplyRoleWorkflowNotificationDefaults={onApplyRoleWorkflowNotificationDefaults}
          />

          <section
            ref={directorySectionRef}
            className={`scroll-mt-20 rounded-2xl border bg-[var(--panel)] p-4 ${activeSection === 'directory' ? 'border-cyan-500/45' : 'border-[var(--line)]'}`}
          >
            <AppSectionTitle title="User Directory" className="mb-4" />
            <p className="mt-1 text-[0.84rem] text-[var(--muted)]">Search, filter, and open user profiles.</p>
            <UserDirectoryListSection
              sortedUsers={sortedUsers}
              listUsers={listUsers}
              searchTerm={searchTerm}
              roleFilter={roleFilter}
              sortKey={sortKey}
              sortDirection={sortDirection}
              roleBadgeClassName={roleBadgeClassName}
              formatAccessiblePages={formatAccessiblePages}
              onSearchTermChange={onSearchTermChange}
              onRoleFilterChange={onRoleFilterChange}
              onSortKeyChange={onSortKeyChange}
              onSortDirectionChange={onSortDirectionChange}
              onSelectUser={onSelectUser}
            />
          </section>

          <section
            className={`scroll-mt-20 rounded-2xl border bg-[var(--panel)] p-4 ${activeSection === 'create' ? 'border-cyan-500/45' : 'border-[var(--line)]'}`}
            ref={createUserSectionRef}
          >
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
              onRegenerateTemporaryPassword={onRegenerateTemporaryPassword}
            />
          </section>
      </div>
    </section>
  );
}
