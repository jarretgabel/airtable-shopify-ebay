import { PAGE_DEFINITIONS, type AppPage } from '@/auth/pages';
import { USER_PAGE_ACCESS_GROUPS } from '@/components/users/userPageAccessGroups';

export interface UserPageAccessEditorProps {
  selectedPages: AppPage[];
  checkboxClassName: string;
  disabled?: boolean;
  onTogglePage: (page: AppPage) => void;
}

export function UserPageAccessEditor({
  selectedPages,
  checkboxClassName,
  disabled = false,
  onTogglePage,
}: UserPageAccessEditorProps) {
  return (
    <div className="space-y-3">
      {USER_PAGE_ACCESS_GROUPS.map((group) => (
        <section key={group.key} className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="mb-3">
            <p className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-slate-300">{group.title}</p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{group.description}</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {group.pages.map((page) => (
              <label key={page} className="inline-flex items-center gap-2 text-sm text-[var(--ink)]">
                <input
                  type="checkbox"
                  className={checkboxClassName}
                  checked={selectedPages.includes(page)}
                  disabled={disabled}
                  onChange={() => onTogglePage(page)}
                />
                <span>{PAGE_DEFINITIONS[page].label}</span>
              </label>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}