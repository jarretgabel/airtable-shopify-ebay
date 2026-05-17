import { AppPageStatSection } from '@/components/app/AppPageStatSection';
import { AppPageHeader } from '@/components/app/AppPageHeader';
import { DashboardSourceWarning, MetricRow } from '@/components/dashboard/dashboardPrimitives';
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
  eyebrow?: string;
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
    <div className="space-y-4">
      <AppPageHeader eyebrow={eyebrow} title={title} description={description} />

      <PanelSurface>
        <div className="flex flex-col gap-4">

          {warnings.map((warning) => (
            <DashboardSourceWarning
              key={warning}
              title="Configuration or sync attention needed"
              message={warning}
            />
          ))}

          <AppPageStatSection stats={stats} />

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
    </div>
  );
}