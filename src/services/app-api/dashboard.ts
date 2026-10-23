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
