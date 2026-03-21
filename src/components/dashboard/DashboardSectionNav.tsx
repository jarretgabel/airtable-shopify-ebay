interface DashboardSectionLink {
  id: string;
  label: string;
}

interface DashboardSectionNavProps {
  sections: DashboardSectionLink[];
  activeSectionId: string;
  onSelectSection: (sectionId: string) => void;
}

function sectionButtonClass(active: boolean): string {
  return [
    'inline-flex items-center rounded-full border px-3 py-1.5 text-[0.74rem] font-semibold transition',
    active
      ? 'border-sky-400/60 bg-sky-500/15 text-sky-200 shadow-[0_8px_18px_rgba(56,189,248,0.14)]'
      : 'border-white/10 bg-slate-950/35 text-[var(--muted)] hover:border-white/20 hover:bg-white/5 hover:text-[var(--ink)]',
  ].join(' ');
}

export function DashboardSectionNav({ sections, activeSectionId, onSelectSection }: DashboardSectionNavProps) {
  return (
    <nav
      aria-label="Dashboard sections"
      className="sticky top-3 z-20 overflow-x-auto rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(7,17,28,0.94),rgba(7,17,28,0.82))] px-3 py-3 shadow-[0_18px_40px_rgba(2,6,23,0.35)] backdrop-blur-md"
    >
      <div className="flex min-w-max items-center gap-2">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            className={sectionButtonClass(section.id === activeSectionId)}
            onClick={() => onSelectSection(section.id)}
          >
            {section.label}
          </button>
        ))}
      </div>
    </nav>
  );
}