import { ASSIGNABLE_PAGES, AppPage, PAGE_DEFINITIONS } from '@/auth/pages';
import type { AppUser } from '@/stores/auth/authTypes';

interface UserDetailPanelProps {
  selectedUser: AppUser;
  statusMessage: string | null;
  labelClassName: string;
  inputClassName: string;
  checkboxClassName: string;
  roleBadgeClassName: (role: AppUser['role']) => string;
  onBackToList: () => void;
  onRoleChange: (role: 'admin' | 'user') => void;
  onTogglePermission: (page: AppPage) => void;
  onSendPasswordReset: () => void;
}

export function UserDetailPanel({
  selectedUser,
  statusMessage,
  labelClassName,
  inputClassName,
  checkboxClassName,
  roleBadgeClassName,
  onBackToList,
  onRoleChange,
  onTogglePermission,
  onSendPasswordReset,
}: UserDetailPanelProps) {
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

      {statusMessage && (
        <p className="mb-4 rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {statusMessage}
        </p>
      )}

      <article className="flex flex-col gap-4 rounded-2xl border border-white/15 bg-slate-950/45 p-4 shadow-[0_12px_26px_rgba(0,0,0,0.28)]">
        <div>
          <p className="m-0 text-xs uppercase tracking-[0.12em] text-slate-300">User ID</p>
          <p className="mt-1 font-mono text-sm text-slate-200">{selectedUser.id}</p>
        </div>

        <label className={labelClassName} htmlFor={`role-${selectedUser.id}`}>
          Role
        </label>
        <select
          id={`role-${selectedUser.id}`}
          className={inputClassName}
          value={selectedUser.role}
          onChange={(event) => onRoleChange(event.target.value === 'admin' ? 'admin' : 'user')}
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
                  onChange={() => onTogglePermission(page)}
                />
                <span>{PAGE_DEFINITIONS[page].label}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
          onClick={onSendPasswordReset}
        >
          Send Password Reset Email
        </button>
      </article>
    </section>
  );
}
