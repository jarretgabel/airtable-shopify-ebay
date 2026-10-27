import { useEffect, useState } from 'react';
import { dashboardAppApi } from '@/services/app-api';
import type { ReportsSummary } from '@/services/app-api/dashboard';
import { DashboardSectionPanel, DashboardSourceWarning, DashboardSubPanel } from './dashboardPrimitives';

interface DashboardReportsSectionProps {
  showWarnings?: boolean;
  loadReports?: () => Promise<ReportsSummary>;
}

const loadDefaultReports = () => dashboardAppApi.getReports();
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function ReportTable({ headers, rows }: { headers: string[]; rows: Array<Array<string | number>> }) {
  return (
    <table className="w-full text-left text-[0.82rem] text-[var(--ink)]">
      <thead>
        <tr className="text-[0.68rem] uppercase tracking-[0.08em] text-[var(--muted)]">
          {headers.map((header) => <th key={header} className="py-1 pr-3">{header}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={String(row[0])} className="border-t border-[var(--line)]">
            {row.map((cell, index) => <td key={index} className="py-1.5 pr-3">{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DashboardReportsSection({ showWarnings = false, loadReports = loadDefaultReports }: DashboardReportsSectionProps) {
  const [reports, setReports] = useState<ReportsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadReports()
      .then((result) => { if (!cancelled) setReports(result); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load reports.'); });
    return () => { cancelled = true; };
  }, [loadReports]);

  if (error) {
    return showWarnings ? (
      <DashboardSectionPanel id="reports" title="Reports">
        <DashboardSourceWarning title="Reports unavailable" message={error} />
      </DashboardSectionPanel>
    ) : null;
  }
  if (!reports) return null;

  return (
    <DashboardSectionPanel id="reports" title="Reports">
      <DashboardSubPanel title="Inventory by status">
        <ReportTable headers={['Status', 'Items']} rows={reports.inventoryByStatus.map((row) => [row.status, row.count])} />
      </DashboardSubPanel>
      <DashboardSubPanel title="Average time in each stage (finished stays only)">
        <ReportTable headers={['Stage', 'Avg days', 'Stays']} rows={reports.timeInStage.map((row) => [row.status, row.avgDays, row.stints])} />
      </DashboardSubPanel>
      <DashboardSubPanel title="Shipped items by brand">
        <ReportTable headers={['Brand', 'Items', 'Total cost']} rows={reports.shippedByBrand.map((row) => [row.brand, row.count, currency.format(row.totalCost)])} />
      </DashboardSubPanel>
    </DashboardSectionPanel>
  );
}
