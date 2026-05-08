import { DashboardSourceWarning, MetricRow, StatTile } from '@/components/dashboard/dashboardPrimitives';
import { PanelSurface } from '@/components/app/StateSurfaces';

interface ListingsServiceSummaryStat {
  label: string;
  value: string | number;
}

interface ListingsServiceSummaryMetric {
  label: string;
  value: string | number;
  valueClass?: string;
}

interface ListingsServiceSummaryPanelProps {
  eyebrow: string;
  title: string;
  description: string;
  warnings?: string[];
  stats: ListingsServiceSummaryStat[];
  metrics: ListingsServiceSummaryMetric[];
}

export function ListingsServiceSummaryPanel({
  eyebrow,
  title,
  description,
  warnings = [],
  stats,
  metrics,
}: ListingsServiceSummaryPanelProps) {
  return (
    <PanelSurface>
      <div className="flex flex-col gap-4">
        <div className="border-b border-[var(--line)] pb-4">
          <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{eyebrow}</p>
          <h2 className="m-0 mt-1 text-[1.18rem] font-semibold text-[var(--ink)]">{title}</h2>
          <p className="m-0 mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">{description}</p>
        </div>

        {warnings.map((warning) => (
          <DashboardSourceWarning
            key={warning}
            title="Configuration or sync attention needed"
            message={warning}
          />
        ))}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((stat) => (
            <StatTile key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-x-6 max-[520px]:grid-cols-1">
          {metrics.map((metric) => (
            <MetricRow
              key={metric.label}
              label={metric.label}
              value={metric.value}
              valueClass={metric.valueClass}
            />
          ))}
        </div>
      </div>
    </PanelSurface>
  );
}