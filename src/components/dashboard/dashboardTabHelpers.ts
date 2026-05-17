import type {
  DashboardSection,
  ShopifyProduct,
} from '@/components/dashboard/dashboardTabTypes';

interface DashboardSummaryMetrics {
  totalAsk: number;
  submissionWindowTotal: number;
  submissionAverage: number;
  activeSubmissionDays: number;
  peakSubmissionDay: { label: string; count: number } | null;
  peakSubmissionShare: number;
  chartGuideValues: number[];
}

export function buildDashboardSummaryMetrics(
  activeProducts: ShopifyProduct[],
  submissionDays: Array<{ label: string; count: number }>,
  maxDayCount: number,
): DashboardSummaryMetrics {
  const totalAsk = activeProducts.reduce((sum, product) => {
    const ask = parseFloat(product.variants?.[0]?.price ?? '0') || 0;
    return ask > 0 ? sum + ask : sum;
  }, 0);

  const submissionWindowTotal = submissionDays.reduce((sum, day) => sum + day.count, 0);
  const submissionAverage = submissionDays.length ? submissionWindowTotal / submissionDays.length : 0;
  const activeSubmissionDays = submissionDays.filter((day) => day.count > 0).length;
  const peakSubmissionDay = submissionDays.reduce<{ label: string; count: number } | null>((peak, day) => (!peak || day.count > peak.count ? day : peak), null);
  const peakSubmissionShare = submissionWindowTotal > 0 && peakSubmissionDay ? Math.round((peakSubmissionDay.count / submissionWindowTotal) * 100) : 0;

  return {
    totalAsk,
    submissionWindowTotal,
    submissionAverage,
    activeSubmissionDays,
    peakSubmissionDay,
    peakSubmissionShare,
    chartGuideValues: [maxDayCount, Math.max(1, Math.round(maxDayCount / 2))],
  };
}

export function buildDashboardSections({
  showActionsSection,
  showInsightsSection,
}: {
  showActionsSection: boolean;
  showInsightsSection: boolean;
}): DashboardSection[] {
  const sections: DashboardSection[] = [{ id: 'overview', label: 'Overview' }];

  if (showActionsSection) {
    sections.push({ id: 'actions', label: 'Actions' });
  }

  if (showInsightsSection) {
    sections.push({ id: 'insights', label: 'Insights' });
  }

  return sections;
}

