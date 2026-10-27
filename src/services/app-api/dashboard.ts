import { getJson } from './http';

export interface SellerSummaryRow {
  email: string;
  location: string | null;
  mailingListOptIn: boolean;
  itemCount: number;
  lastItemDate: string | null;
}

export interface SellersSummary {
  totals: { contacts: number; sellersWithItems: number; repeatSellers: number; mailingListOptIns: number };
  topSellers: SellerSummaryRow[];
}

export function getSellersSummary(limit = 10): Promise<SellersSummary> {
  return getJson<SellersSummary>('/api/dashboard/sellers-summary', { limit });
}

export interface RecordHistoryEntry {
  id: string;
  at: string;
  op: 'create' | 'update' | 'delete';
  fields: Record<string, unknown>;
}

export async function getRecordHistory(source: string, recordId: string, limit = 100): Promise<RecordHistoryEntry[]> {
  const result = await getJson<{ entries: RecordHistoryEntry[] }>(`/api/audit/${encodeURIComponent(source)}/${encodeURIComponent(recordId)}`, { limit });
  return result.entries;
}
