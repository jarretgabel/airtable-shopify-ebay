import {
  ASSIGNABLE_USER_ROLE_OPTIONS,
  USED_GEAR_WORKFLOW_NOTIFICATION_EVENT_OPTIONS,
  type UsedGearWorkflowNotificationEvent,
  type UserRole,
} from '@/stores/auth/authTypes';
import type { RoleWorkflowNotificationDefaults } from '@/services/roleNotificationDefaults';

interface RoleNotificationDefaultsPanelProps {
  roleNotificationDefaults: RoleWorkflowNotificationDefaults;
  checkboxClassName: string;
  onToggleRoleWorkflowNotificationDefault: (role: UserRole, eventKey: UsedGearWorkflowNotificationEvent, enabled: boolean) => void;
  onApplyRoleWorkflowNotificationDefaults: (role: UserRole) => void;
}

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'Default workflow alert subscriptions for admin users.',
  owner: 'Default workflow alerts for owners with full application and business-metrics access.',
  processor: 'Baseline workflow alerts for processors across intake, stage work, and publish readiness.',
  tester: 'Default workflow alerts for testing-focused users.',
  photographer: 'Default workflow alerts for photography-focused users.',
};

export function RoleNotificationDefaultsPanel({
  roleNotificationDefaults,
  checkboxClassName,
  onToggleRoleWorkflowNotificationDefault,
  onApplyRoleWorkflowNotificationDefaults,
}: RoleNotificationDefaultsPanelProps) {
  return (
    <section className="rounded-2xl border border-white/15 bg-slate-950/45 p-4 shadow-[0_12px_26px_rgba(0,0,0,0.28)]">
      <div className="mb-3">
        <h3 className="m-0 text-[0.95rem] font-extrabold uppercase tracking-[0.07em] text-[var(--ink)]">Role Workflow Alert Defaults</h3>
        <p className="mt-1 text-[0.84rem] text-[var(--muted)]">Configure baseline workflow alerts per role. Individual users can still override these defaults, and you can push the role defaults onto current members when needed.</p>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {ASSIGNABLE_USER_ROLE_OPTIONS.map((roleOption) => (
          <article key={roleOption.value} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="m-0 text-sm font-semibold text-[var(--ink)]">{roleOption.label}</h4>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{ROLE_DESCRIPTIONS[roleOption.value]}</p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-white/10"
                onClick={() => onApplyRoleWorkflowNotificationDefaults(roleOption.value)}
              >
                Apply To Current {roleOption.label}s
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {USED_GEAR_WORKFLOW_NOTIFICATION_EVENT_OPTIONS.map((option) => (
                <label key={`${roleOption.value}-${option.key}`} className="rounded-xl border border-white/10 bg-slate-950/35 px-3 py-2 text-sm text-[var(--ink)]">
                  <span className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className={checkboxClassName}
                      checked={roleNotificationDefaults[roleOption.value][option.key]}
                      onChange={(event) => onToggleRoleWorkflowNotificationDefault(roleOption.value, option.key, event.target.checked)}
                    />
                    <span>
                      <span className="block font-semibold">{option.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">{option.description}</span>
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}