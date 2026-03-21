import { AppUser } from '@/context/AuthContext';
import { RoleFilter, UserSortKey } from '@/components/users/userManagementTypes';

interface UserDirectoryListSectionProps {
  sortedUsers: AppUser[];
  listUsers: AppUser[];
  searchTerm: string;
  roleFilter: RoleFilter;
  sortKey: UserSortKey;
  sortDirection: 'asc' | 'desc';
  labelClassName: string;
  inputClassName: string;
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
  labelClassName,
  inputClassName,
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
      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-4">
        <label className="flex flex-col gap-1.5 lg:col-span-2">
          <span className={labelClassName}>Search</span>
          <input
            type="text"
            className={inputClassName}
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Search by name, email, or pages"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={labelClassName}>Role Filter</span>
          <select className={inputClassName} value={roleFilter} onChange={(event) => onRoleFilterChange(event.target.value as RoleFilter)}>
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
        </label>

        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className={labelClassName}>Sort By</span>
            <select className={inputClassName} value={sortKey} onChange={(event) => onSortKeyChange(event.target.value as UserSortKey)}>
              <option value="name">Name</option>
              <option value="email">Email</option>
              <option value="role">Role</option>
              <option value="pages">Accessible Pages</option>
            </select>
          </label>

          <label className="flex w-[6.5rem] flex-col gap-1.5">
            <span className={labelClassName}>Order</span>
            <select className={inputClassName} value={sortDirection} onChange={(event) => onSortDirectionChange(event.target.value as 'asc' | 'desc')}>
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