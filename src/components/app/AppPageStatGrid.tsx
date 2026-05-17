import { StatTile } from '@/components/dashboard/dashboardPrimitives';

export interface AppPageStatItem {
  label: string;
  value: string | number;
}

interface AppPageStatGridProps {
  stats: AppPageStatItem[];
  className?: string;
}

export function AppPageStatGrid({ stats, className }: AppPageStatGridProps) {
  return (
    <div className={`grid grid-cols-2 gap-3 lg:grid-cols-4 ${className ?? ''}`.trim()}>
      {stats.map((stat) => (
        <StatTile key={stat.label} label={stat.label} value={stat.value} />
      ))}
    </div>
  );
}