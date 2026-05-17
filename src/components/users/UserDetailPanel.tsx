import { getRoleDefaultPages, hasFullAccessRole } from '@/auth/roleAccess';
import { PageTitleHeader } from '@/components/app/PageTitleHeader';
import { UserPageAccessEditor } from '@/components/users/UserPageAccessEditor';
import {
  ASSIGNABLE_USER_ROLE_OPTIONS,
  USED_GEAR_WORKFLOW_NOTIFICATION_EVENT_OPTIONS,
  type AppUser,
  type UsedGearWorkflowNotificationEvent,
} from '@/stores/auth/authTypes';

interface UserDetailPanelProps {
  selectedUser: AppUser;
  canDeleteSelectedUser: boolean;
  deleteDisabledReason?: string;
  canSendPasswordReset: boolean;
  passwordResetDisabledReason?: string;
  statusMessage: string | null;
  labelClassName: string;
  inputClassName: string;
  checkboxClassName: string;
  roleBadgeClassName: (role: AppUser['role']) => string;
  onBackToList: () => void;
  onRoleChange: (role: AppUser['role']) => void;
  onToggleWorkflowOwnershipPreference: (key: 'workflowAssignedAlertsEnabled' | 'workflowUnassignedAlertsEnabled', enabled: boolean) => void;
  onToggleWorkflowNotificationEvent: (eventKey: UsedGearWorkflowNotificationEvent, enabled: boolean) => void;
  onSendPasswordReset: () => void;
  onDeleteUser: () => void;
}

export function UserDetailPanel({
  selectedUser,
  canDeleteSelectedUser,
  deleteDisabledReason,
  canSendPasswordReset,
  passwordResetDisabledReason,
  statusMessage,
  labelClassName,
  inputClassName,
  checkboxClassName,
  roleBadgeClassName,
  onBackToList,
  onRoleChange,
  onToggleWorkflowOwnershipPreference,
  onToggleWorkflowNotificationEvent,
  onSendPasswordReset,
  onDeleteUser,
}: UserDetailPanelProps) {
  const isOwner = selectedUser.role === 'owner';
  const isDeveloper = selectedUser.role === 'developer';
  const hasFullAccess = hasFullAccessRole(selectedUser.role);
  const roleAccessPages = hasFullAccess ? [] : getRoleDefaultPages(selectedUser.role);
  const roleOptions = isOwner
    ? [{ value: 'owner' as const, label: 'Owner (script-managed)' }]
    : ASSIGNABLE_USER_ROLE_OPTIONS;

  return (
    <section className="space-y-5">
      <PageTitleHeader eyebrow="Utilities" title="User Management" />

      <section className="rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-4">
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

        {isOwner ? (
          <div>
            <p className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-slate-300">Role</p>
            <p className="mt-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-semibold text-[var(--ink)]">Owner (script-managed)</p>
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">Owner assignment is package-script only and cannot be changed from the app.</p>
          </div>
        ) : (
          <>
            <label className={labelClassName} htmlFor={`role-${selectedUser.id}`}>
              Role
            </label>
            <select
              id={`role-${selectedUser.id}`}
              className={inputClassName}
              value={selectedUser.role}
              onChange={(event) => onRoleChange(event.target.value as AppUser['role'])}
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </>
        )}

        <div>
          <p className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-slate-300">Accessible Pages</p>
          {isOwner ? (
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-[var(--muted)]">
              <p className="m-0 font-semibold text-[var(--ink)]">Full app access</p>
              <p className="mt-2 text-xs leading-5">Owners keep full app access. Page permissions for owner accounts are managed outside User Management.</p>
            </div>
          ) : (
            <>
              <UserPageAccessEditor
                userRole={selectedUser.role}
                  selectedPages={roleAccessPages}
                checkboxClassName={checkboxClassName}
                  disabled
                  onTogglePage={() => undefined}
              />
                <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                  {hasFullAccess
                    ? `${selectedUser.role === 'admin' ? 'Admins' : 'Owners'} keep full app access. Page groupings are shown here for reference only.`
                    : 'Each user is limited to one role bundle. Change the role to switch access; individual page mixing is disabled.'}
                </p>
            </>
          )}
        </div>

        <div>
          <p className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-slate-300">Used Gear Workflow Alerts</p>
          {isOwner ? (
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-[var(--muted)]">
              <p className="m-0 font-semibold text-[var(--ink)]">Owner-managed notification preferences</p>
              <p className="mt-2 text-xs leading-5">Manage owner notification preferences from Account Settings while signed into the owner account.</p>
            </div>
          ) : isDeveloper ? (
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-[var(--muted)]">
              <p className="m-0 font-semibold text-[var(--ink)]">Developer notifications only</p>
              <p className="mt-2 text-xs leading-5">Developer accounts can access the JotForm source feed and dashboard module, but used-gear workflow alert subscriptions remain disabled.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-[var(--ink)]">
                  <span className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className={checkboxClassName}
                      checked={selectedUser.notificationPreferences.workflowAssignedAlertsEnabled}
                      onChange={(event) => onToggleWorkflowOwnershipPreference('workflowAssignedAlertsEnabled', event.target.checked)}
                    />
                    <span>
                      <span className="block font-semibold">Assigned to user</span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">Keep workflow alerts for records assigned to this user.</span>
                    </span>
                  </span>
                </label>
                <label className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-[var(--ink)]">
                  <span className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className={checkboxClassName}
                      checked={selectedUser.notificationPreferences.workflowUnassignedAlertsEnabled}
                      onChange={(event) => onToggleWorkflowOwnershipPreference('workflowUnassignedAlertsEnabled', event.target.checked)}
                    />
                    <span>
                      <span className="block font-semibold">Unassigned work</span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">Keep workflow alerts for rows that still need an owner.</span>
                    </span>
                  </span>
                </label>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {USED_GEAR_WORKFLOW_NOTIFICATION_EVENT_OPTIONS.map((option) => (
                  <label key={`${selectedUser.id}-${option.key}`} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-[var(--ink)]">
                    <span className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className={checkboxClassName}
                        checked={selectedUser.notificationPreferences.workflowEvents[option.key]}
                        onChange={(event) => onToggleWorkflowNotificationEvent(option.key, event.target.checked)}
                      />
                      <span>
                        <span className="block font-semibold">{option.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">{option.description}</span>
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {isOwner ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-[var(--muted)]">
            <p className="m-0 font-semibold text-[var(--ink)]">Password management</p>
            <p className="mt-2 text-xs leading-5">Owner password changes must be handled by the owner through Account Settings.</p>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onSendPasswordReset}
              disabled={!canSendPasswordReset}
              title={canSendPasswordReset ? 'Send password reset email' : passwordResetDisabledReason}
            >
              Send Password Reset Email
            </button>
            {!canSendPasswordReset && passwordResetDisabledReason && (
              <p className="-mt-2 text-xs leading-5 text-[var(--muted)]">{passwordResetDisabledReason}</p>
            )}
          </>
        )}

        {isOwner ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-[var(--muted)]">
            <p className="m-0 font-semibold text-[var(--ink)]">Owner account protection</p>
            <p className="mt-2 text-xs leading-5">Owner account deletion and other owner-specific mutations are hidden in User Management and remain script-managed or self-managed through the owner session.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3">
            <p className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-rose-300">Danger Zone</p>
            <p className="mt-1 text-sm text-rose-200/90">Delete this user account from Airtable and revoke access immediately.</p>
            <button
              type="button"
              className="mt-3 rounded-xl border border-rose-300/50 bg-rose-500/15 px-4 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canDeleteSelectedUser}
              title={canDeleteSelectedUser ? 'Delete user' : deleteDisabledReason}
              onClick={onDeleteUser}
            >
              Delete User
            </button>
            {!canDeleteSelectedUser && deleteDisabledReason && (
              <p className="mt-2 text-xs text-rose-200/80">{deleteDisabledReason}</p>
            )}
          </div>
        )}
      </article>
      </section>
    </section>
  );
}
