import type { DashboardSourceStatus } from '@/components/dashboard/dashboardTabTypes';

export function getDashboardDegradedSources(sources: DashboardSourceStatus[]): DashboardSourceStatus[] {
  return sources.filter((source) => Boolean(source.error));
}

export function hasDashboardPartialData(sources: DashboardSourceStatus[]): boolean {
  const degradedSources = getDashboardDegradedSources(sources);
  if (degradedSources.length === 0) return false;

  return sources.some((source) => !source.error && source.hasData);
}