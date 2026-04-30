import type { ReactNode } from 'react';
import type { DashboardSourceStatus } from '@/components/dashboard/dashboardTabTypes';

const skeletonPulseClass = 'animate-pulse rounded-md bg-white/10';

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
  unavailableReason,
}: {
  borderToneClass: string;
  eyebrow: string;
  value: ReactNode;
  detail: ReactNode;
  trend: string;
  trendClass: string;
  onClick: () => void;
  unavailableReason?: string | null;
}) {
  return (
    <button
      type="button"
      className={`w-full appearance-none rounded-[14px] border border-[var(--line)] border-t-[3px] bg-[var(--panel)] px-4 pb-3 pt-3 text-left text-[var(--ink)] shadow-[0_1px_3px_rgba(17,32,49,0.06),0_4px_14px_rgba(17,32,49,0.05)] transition focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-200 ${borderToneClass} ${unavailableReason ? 'cursor-not-allowed opacity-85' : 'hover:-translate-y-px hover:shadow-[0_2px_6px_rgba(17,32,49,0.09),0_8px_24px_rgba(17,32,49,0.08)]'}`}
      disabled={Boolean(unavailableReason)}
      title={unavailableReason ?? undefined}
      onClick={() => {
        if (!unavailableReason) {
          onClick();
        }
      }}
    >
      <div className="mb-0.5 flex items-center gap-2">
        <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{eyebrow}</span>
        {unavailableReason ? <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-amber-200">Unavailable</span> : null}
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

export function DashboardLoadingBanner({ label }: { label: string }) {
  return (
    <div className="rounded-[12px] border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
      {label}
    </div>
  );
}

export function DashboardStatTileSkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-[12px] border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
          <div className={`${skeletonPulseClass} h-3 w-20`} />
          <div className={`${skeletonPulseClass} mt-2 h-6 w-12`} />
        </div>
      ))}
    </div>
  );
}

export function DashboardMetricRowSkeletonList({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 max-[520px]:grid-cols-1">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex items-center justify-between border-b border-[var(--line)] py-[0.6rem] [&:nth-last-child(-n+2)]:border-b-0">
          <div className={`${skeletonPulseClass} h-3 w-24`} />
          <div className={`${skeletonPulseClass} h-4 w-14`} />
        </div>
      ))}
    </div>
  );
}

export function DashboardBarListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="grid grid-cols-[minmax(90px,140px)_1fr_32px] items-center gap-3">
          <div className={`${skeletonPulseClass} h-3 w-24`} />
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--line)]">
            <div className={`${skeletonPulseClass} h-full w-full`} />
          </div>
          <div className={`${skeletonPulseClass} h-3 w-8 justify-self-end`} />
        </li>
      ))}
    </ul>
  );
}

export function DashboardTableSkeleton({ columns, rows }: { columns: number; rows: number }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-full rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-3">
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }, (_, index) => (
            <div key={`header-${index}`} className={`${skeletonPulseClass} h-3 w-20`} />
          ))}
          {Array.from({ length: rows * columns }, (_, index) => (
            <div key={`cell-${index}`} className={`${skeletonPulseClass} h-4 w-full`} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function DashboardWorkflowCardSkeletonGrid({ count = 3 }: { count?: number }) {
  const gridClass =
    count >= 3
      ? 'grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3'
      : 'grid grid-cols-1 gap-3 lg:grid-cols-2';

  return (
    <div className={gridClass}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex h-full flex-col gap-3 rounded-[16px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(104,164,255,0.1),transparent_56%),linear-gradient(180deg,rgba(15,23,42,0.9),rgba(8,15,26,0.96))] p-4">
          <div className={`${skeletonPulseClass} h-3 w-20 bg-sky-200/20`} />
          <div className={`${skeletonPulseClass} h-5 w-32 bg-white/15`} />
          <div className="space-y-2">
            <div className={`${skeletonPulseClass} h-3 w-full bg-white/10`} />
            <div className={`${skeletonPulseClass} h-3 w-5/6 bg-white/10`} />
            <div className={`${skeletonPulseClass} h-3 w-2/3 bg-white/10`} />
          </div>
          <div className="mt-auto flex gap-2">
            <div className={`${skeletonPulseClass} h-6 w-20 rounded-full bg-sky-200/15`} />
            <div className={`${skeletonPulseClass} h-6 w-16 rounded-full bg-sky-200/15`} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardSourceWarning({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="rounded-[12px] border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-[0.82rem] text-amber-100">
      <p className="m-0 font-semibold text-amber-200">{title}</p>
      <p className="m-0 mt-1 text-amber-100/85">{message}</p>
    </div>
  );
}

export function DashboardPartialDataNotice({
  degradedSources,
}: {
  degradedSources: DashboardSourceStatus[];
}) {
  if (degradedSources.length === 0) return null;

  return (
    <section className="rounded-[14px] border border-amber-400/35 bg-amber-500/10 px-4 py-4 text-amber-100 shadow-[0_1px_3px_rgba(17,32,49,0.06),0_4px_14px_rgba(17,32,49,0.05)]">
      <p className="m-0 text-[0.78rem] font-bold uppercase tracking-[0.08em] text-amber-200">Partial dashboard data</p>
      <p className="m-0 mt-2 text-[0.88rem] text-amber-100/90">
        Some sources failed to refresh. The dashboard is still showing the most recent successful data where it was available.
      </p>
      <ul className="m-0 mt-3 space-y-2 pl-5 text-[0.82rem] text-amber-100/85">
        {degradedSources.map((source) => (
          <li key={source.key}>
            <strong className="font-semibold text-amber-100">{source.label}:</strong> {source.error}
          </li>
        ))}
      </ul>
    </section>
  );
}
