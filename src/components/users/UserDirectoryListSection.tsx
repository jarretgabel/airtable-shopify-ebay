import { QueueSearchToolbar } from '@/components/app/QueueSearchToolbar';
import type { AppUser } from '@/stores/auth/authTypes';
import { RoleFilter, UserSortKey } from '@/components/users/userManagementTypes';

interface UserDirectoryListSectionProps {
  sortedUsers: AppUser[];
  listUsers: AppUser[];
  searchTerm: string;
  roleFilter: RoleFilter;
  sortKey: UserSortKey;
  sortDirection: 'asc' | 'desc';
  roleBadgeClassName: (role: AppUser['role']) => string;
  formatAccessiblePages: (user: AppUser) => string;
  onSearchTermChange: (value: string) => void;
  onRoleFilterChange: (value: RoleFilter) => void;
  onSortKeyChange: (value: UserSortKey) => void;
  onSortDirectionChange: (value: 'asc' | 'desc') => void;
  onSelectUser: (userId: string) => void;
}

export function UserDirectoryListSection({
  sortedUsers,
  listUsers,
  searchTerm,
  roleFilter,
  sortKey,
  sortDirection,
  roleBadgeClassName,
  formatAccessiblePages,
  onSearchTermChange,
  onRoleFilterChange,
  onSortKeyChange,
  onSortDirectionChange,
  onSelectUser,
}: UserDirectoryListSectionProps) {
  return (
    <section className="rounded-2xl border border-white/15 bg-slate-950/45 p-4 shadow-[0_12px_26px_rgba(0,0,0,0.28)]">
      <QueueSearchToolbar
        className="mb-4"
        searchAriaLabel="Search users"
        searchPlaceholder="Search by name, email, or role access"
        searchValue={searchTerm}
        onSearchChange={onSearchTermChange}
        filters={[
          {
            ariaLabel: 'Filter users by role',
            value: roleFilter,
            onChange: (value) => onRoleFilterChange(value as RoleFilter),
            options: [
              { value: 'all', label: 'All Roles' },
              { value: 'admin', label: 'Admin' },
              { value: 'owner', label: 'Owner' },
              { value: 'developer', label: 'Developer' },
              { value: 'processor', label: 'Processor' },
              { value: 'tester', label: 'Tester' },
              { value: 'photographer', label: 'Photographer' },
            ],
          },
          {
            ariaLabel: 'Sort users by',
            value: sortKey,
            onChange: (value) => onSortKeyChange(value as UserSortKey),
            options: [
              { value: 'name', label: 'Sort: Name' },
              { value: 'email', label: 'Sort: Email' },
              { value: 'role', label: 'Sort: Role' },
              { value: 'pages', label: 'Sort: Role Access' },
            ],
          },
          {
            ariaLabel: 'Sort user order',
            value: sortDirection,
            onChange: (value) => onSortDirectionChange(value as 'asc' | 'desc'),
            options: [
              { value: 'asc', label: 'Order: Asc' },
              { value: 'desc', label: 'Order: Desc' },
            ],
          },
        ]}
      />

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
              <th className="border-b border-white/15 px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-300">Role Access</th>
              <th className="border-b border-white/15 px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-300">Actions</th>
            </tr>
          </thead>
          <tbody>
            {listUsers.map((user) => (
              <tr key={user.id} className="transition hover:bg-white/5">
                <td className="border-b border-white/10 px-3 py-2.5 font-medium text-[var(--ink)]">{user.name}</td>
                <td className="border-b border-white/10 px-3 py-2.5 text-[var(--muted)]">{user.email}</td>
                <td className="border-b border-white/10 px-3 py-2.5"><span className={roleBadgeClassName(user.role)}>{user.role}</span></td>
                <td className="max-w-[380px] border-b border-white/10 px-3 py-2.5 text-[var(--muted)]">{formatAccessiblePages(user)}</td>
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
  );
}