import { getJson, patchJson, postJson } from './http';

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

export interface ReportsSummary {
  inventoryByStatus: Array<{ status: string; count: number }>;
  timeInStage: Array<{ status: string; avgDays: number; stints: number }>;
  shippedByBrand: Array<{ brand: string; count: number; totalCost: number }>;
}

export function getReports(): Promise<ReportsSummary> {
  return getJson<ReportsSummary>('/api/dashboard/reports');
}

export type InteractionKind = 'email' | 'call' | 'text' | 'visit' | 'note' | 'other';

export interface CrmContactRow { id: string; email: string; name: string | null; location: string | null; itemCount: number; openFollowUps: number }
export interface CrmContactDetail {
  contact: { id: string; email: string; name: string | null; phone: string | null; location: string | null; mailingListOptIn: boolean };
  items: Array<{ recordId: string | null; sku: string | null; make: string | null; model: string | null; status: string | null }>;
  interactions: Array<{ id: string; kind: InteractionKind; occurredAt: string; summary: string | null; createdBy: string | null }>;
  followUps: Array<{ id: string; dueAt: string; status: string; note: string | null }>;
}
export interface CrmDueFollowUp { id: string; contactId: string; contactEmail: string; dueAt: string; note: string | null }

export async function searchCrmContacts(search: string): Promise<CrmContactRow[]> {
  return (await getJson<{ contacts: CrmContactRow[] }>('/api/dashboard/crm/contacts', { search: search || undefined })).contacts;
}

export function getCrmContact(contactId: string): Promise<CrmContactDetail> {
  return getJson<CrmContactDetail>(`/api/dashboard/crm/contacts/${encodeURIComponent(contactId)}`);
}

export async function getCrmDueFollowUps(): Promise<CrmDueFollowUp[]> {
  return (await getJson<{ followUps: CrmDueFollowUp[] }>('/api/dashboard/crm/follow-ups/due')).followUps;
}

export function addCrmInteraction(contactId: string, kind: InteractionKind, summary: string): Promise<{ saved: true }> {
  return postJson(`/api/dashboard/crm/contacts/${encodeURIComponent(contactId)}/interactions`, { kind, summary });
}

export function addCrmFollowUp(contactId: string, dueAt: string, note: string): Promise<{ saved: true }> {
  return postJson(`/api/dashboard/crm/contacts/${encodeURIComponent(contactId)}/follow-ups`, { dueAt, note });
}

export function closeCrmFollowUp(followUpId: string, status: 'done' | 'cancelled'): Promise<{ saved: true }> {
  return patchJson(`/api/dashboard/crm/follow-ups/${encodeURIComponent(followUpId)}`, { status });
}
