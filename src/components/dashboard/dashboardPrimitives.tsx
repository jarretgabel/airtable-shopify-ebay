import type { ReactNode } from 'react';

/**
 * Small stat-summary tile used inside DashboardSubPanel stat grids (e.g. "Active Mix 50%").
 * Uses bg-[var(--panel)] to create contrast against the sub-panel's bg-[var(--bg)] background.
 */
export function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[12px] border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
      <p className="m-0 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p>
      <p className="m-0 mt-1 text-[1.1rem] font-bold text-[var(--ink)]">{value}</p>
    </div>
  );
}

/**
 * Horizontal key/value row with a bottom separator, used inside DashboardSubPanel metric lists.
 */
export function MetricRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string | number;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--line)] py-[0.6rem] [&:nth-last-child(-n+2)]:border-b-0">
      <span className="text-[0.8rem] text-[var(--muted)]">{label}</span>
      <span className={`text-[0.9rem] font-bold [font-variant-numeric:tabular-nums] ${valueClass ?? 'text-[var(--ink)]'}`}>
        {value}
      </span>
    </div>
  );
}

/**
 * Reusable KPI summary card used in the Dashboard overview grid.
 */
export function DashboardKpiCard({
  borderToneClass,
  eyebrow,
  value,
  detail,
  trend,
  trendClass,
  onClick,
}: {
  borderToneClass: string;
  eyebrow: string;
  value: ReactNode;
  detail: ReactNode;
  trend: string;
  trendClass: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`w-full appearance-none rounded-[14px] border border-[var(--line)] border-t-[3px] bg-[var(--panel)] px-4 pb-3 pt-3 text-left text-[var(--ink)] shadow-[0_1px_3px_rgba(17,32,49,0.06),0_4px_14px_rgba(17,32,49,0.05)] transition hover:-translate-y-px hover:shadow-[0_2px_6px_rgba(17,32,49,0.09),0_8px_24px_rgba(17,32,49,0.08)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-200 ${borderToneClass}`}
      onClick={onClick}
    >
      <div className="mb-0.5 flex items-center gap-2">
        <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{eyebrow}</span>
      </div>
      <p className="m-0 text-[1.65rem] font-bold leading-none tracking-[-0.02em] text-[var(--ink)]">{value}</p>
      <p className="m-0 text-[0.78rem] leading-[1.5] text-[var(--muted)]">{detail}</p>
      <p className={`mt-auto pt-1.5 text-[0.74rem] font-bold uppercase tracking-[0.02em] ${trendClass}`}>{trend}</p>
    </button>
  );
}

const outerPanelClass =
  'flex flex-col gap-4 rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_1px_3px_rgba(17,32,49,0.06),0_4px_14px_rgba(17,32,49,0.05)]';
const panelHeaderClass = 'mb-4 flex items-center border-b border-[var(--line)] pb-3 pt-1';
const panelHeaderLabelClass = 'm-0 text-[1.05rem] font-semibold text-[var(--ink)]';

/**
 * Outer dashboard section panel — the full-width card with scroll anchor, section title h2,
 * and the standard border/shadow/bg treatment shared by every major dashboard section.
 */
export function DashboardSectionPanel({
  id,
  title,
  children,
  className,
}: {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-24 ${outerPanelClass}${className ? ` ${className}` : ''}`}>
      <div className={panelHeaderClass}>
        <h2 className={panelHeaderLabelClass}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

/**
 * Inner nested sub-panel — the recessed bg-[var(--bg)] section used for stats/data
 * blocks inside a DashboardSectionPanel. Accepts an optional ReactNode title rendered as h3.
 */
export function DashboardSubPanel({
  title,
  children,
}: {
  title?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-5">
      {title && (
        <h3 className="m-0 flex items-baseline gap-2 border-b border-[var(--line)] pb-3 text-[0.92rem] font-bold text-[var(--ink)]">
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}
