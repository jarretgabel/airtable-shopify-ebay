import {
  getCombinedListingsRequiredFieldNames,
  getRecordFieldText,
  isCombinedRecordAlreadyListed,
  isCombinedRecordReadyForPublishing,
  isCombinedRecordVisibleOnListingsPage,
  normalizeCombinedWorkflowStatus,
  type CombinedListingsRequiredFieldNames,
} from '../../../shared/combinedListingsReadiness.js';
import { getMissingRequiredFieldNames } from '../../../shared/requiredFieldStatus.js';
import { APPROVAL_QUEUE_FIELDS } from '../../../shared/approvalQueueFields.js';
import { logError } from '../../../shared/logging.js';
import { getPostgresPool } from '../../../db/pool.js';
import { getContactDetail, listContacts } from '../../../db/crm.js';
import { getSellerHistory } from '../../../db/sellerHistory.js';
import { getConfiguredRecord, getConfiguredRecords } from '../../../store/index.js';
import type { AirtableRecord } from '../../airtable/client.js';
import { INTAKE_DRAFT_FIELDS, PHOTOS_DRAFT_FIELDS, TESTING_DRAFT_FIELDS, type AssistantDraft, type DraftKind } from '../../../shared/contracts/intakeDraft.js';
import { buildDraft } from './intake.js';
import { searchAllKnowledge } from './knowledge.js';
import { isProgressOnlyScope, isStatusVisible, pickVisibleFields, resolveItemLink, type AssistantScope } from './scope.js';

const SOURCE = 'used-gear-workflow' as const;
const LISTING_SOURCE = 'approval-combined' as const;
const MAX_RESULTS = 25;
const MAX_SCAN = 500;

const ITEM_AND_DOC_TOOLS = [
  {
    name: 'search_items',
    description: 'Search inventory workflow items AND listings (the Listings page, incl. Ready for Publishing; listing results have kind "listing") — intake through post-publish — the user can see, including titles, prices, marketplace status and product specs where permitted. Optionally filter by free text (make, model, SKU, serial) and exact Workflow Status. Returns up to 25 items.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text match on make, model, SKU, serial number or notes.' },
        status: { type: 'string', description: 'Exact Workflow Status, e.g. "Testing In Progress" or "Photography In Progress".' },
        limit: { type: 'integer', minimum: 1, maximum: MAX_RESULTS },
      },
    },
  },
  {
    name: 'get_item',
    description: 'Get the details of one inventory item by its record id (starts with "rec").',
    input_schema: {
      type: 'object',
      properties: { record_id: { type: 'string' } },
      required: ['record_id'],
    },
  },
  {
    name: 'stage_counts',
    description: 'Count the items the user can see, grouped by Workflow Status.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'search_docs',
    description: 'Search the app guides and process documentation for how-to, workflow, stage, role and page questions (for example "what happens after testing?"). Returns the most relevant passages.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Keywords describing the question.' } },
      required: ['query'],
    },
  },
] as const;

// Customer and seller data is personal data: full-access roles only, matching the /api/dashboard and CRM routes.
const CUSTOMER_TOOLS = [
  {
    name: 'search_customers',
    description: 'Search customers/sellers (contacts) by name, email or location. Returns up to 10 with item and open follow-up counts.',
    input_schema: { type: 'object', properties: { query: { type: 'string' } } },
  },
  {
    name: 'get_customer',
    description: 'Get one customer by contact id (uuid from search_customers): contact details, their items, interactions and follow-ups.',
    input_schema: { type: 'object', properties: { contact_id: { type: 'string' } }, required: ['contact_id'] },
  },
  {
    name: 'get_seller_history',
    description: 'Get a seller\'s full history by email: items sold to us, amounts paid and refunded, interactions, open follow-ups and inquiries.',
    input_schema: { type: 'object', properties: { email: { type: 'string' } }, required: ['email'] },
  },
] as const;

const INTAKE_TOOL = {
  name: 'propose_intake_item',
  description: 'Prepare (not save) a new inventory intake item as a draft for the user to review and confirm. Always send every known field, including values from earlier drafts. Returns the cleaned draft, missing required fields and invalid values. Select fields must match existing options exactly.',
  input_schema: {
    type: 'object',
    properties: Object.fromEntries(INTAKE_DRAFT_FIELDS.map((spec) => [spec.key, { type: 'string', description: spec.label }])),
  },
} as const;

const STAGE_TOOL = {
  name: 'propose_stage_update',
  description: 'Prepare (not save) a Testing or Photography form update for an existing item, for the user to review and confirm. Send every known field each time. Dates are YYYY-MM-DD, times are minutes. Select fields must match existing options exactly. Images are attached by the user in the draft card, not through you.',
  input_schema: {
    type: 'object',
    properties: {
      stage: { type: 'string', enum: ['testing', 'photos'] },
      record_id: { type: 'string', description: 'Item record id (starts with "rec")' },
      ...Object.fromEntries([...TESTING_DRAFT_FIELDS, ...PHOTOS_DRAFT_FIELDS].map((spec) => [spec.key, { type: 'string', description: spec.label }])),
    },
    required: ['stage', 'record_id'],
  },
} as const;

export function canDraftStage(scope: AssistantScope, stage: string): stage is 'testing' | 'photos' {
  return (stage === 'testing' || stage === 'photos') && scope.pages.includes(stage);
}

export function canDraftAnyStage(scope: AssistantScope): boolean {
  return canDraftStage(scope, 'testing') || canDraftStage(scope, 'photos');
}

export function canDraftIntake(scope: AssistantScope): boolean {
  return scope.pages.includes('manual-intake') || scope.pages.includes('create-intake-item');
}

export function getAssistantToolDefinitions(scope: AssistantScope) {
  return [
    ...ITEM_AND_DOC_TOOLS,
    ...(scope.fullAccess ? CUSTOMER_TOOLS : []),
    ...(canDraftIntake(scope) ? [INTAKE_TOOL] : []),
    ...(canDraftAnyStage(scope) ? [STAGE_TOOL] : []),
  ];
}

export interface AssistantToolContext {
  draft?: AssistantDraft;
}

function requireCustomerAccess(scope: AssistantScope): string | null {
  if (!scope.fullAccess) return 'You do not have access to customer data.';
  if (!process.env.DATABASE_URL?.trim()) return 'Customer data needs the Postgres database, which is not configured.';
  return null;
}

function withItemLinks<T extends { recordId?: string | null; airtableRecordId?: string | null }>(scope: AssistantScope, items: T[]) {
  return items.map((item) => {
    const id = item.recordId ?? item.airtableRecordId;
    const link = id ? resolveItemLink(scope, id, undefined) : undefined;
    return link ? { ...item, link } : item;
  });
}

const COUNT_SCAN = 5000;

/** Reads are filtered in the data store: the 500-record cap would otherwise hide the newest items, since records are ordered oldest first. */
async function loadVisibleRecords(
  scope: AssistantScope,
  read: { query?: string; status?: string; fields?: string[]; maxRecords?: number } = {},
): Promise<AirtableRecord[]> {
  const records = await getConfiguredRecords(SOURCE, {
    ...(isProgressOnlyScope(scope) ? { subset: 'workflow-progress' as const } : {}),
    ...(read.query ? { searchQuery: read.query, searchFields: SEARCH_FIELDS } : {}),
    ...(read.status ? { filters: { 'Workflow Status': read.status } } : {}),
    ...(read.fields ? { fields: read.fields } : {}),
    maxRecords: read.maxRecords ?? MAX_SCAN,
  });
  return records.filter((record) => isStatusVisible(scope, record.fields['Workflow Status']));
}

/** Listings (the Listings page, including Ready for Publishing) live in their own table, separate from workflow records. */
export function canViewListings(scope: AssistantScope): boolean {
  return scope.statuses === null && (scope.fullAccess || scope.pages.includes('listings'));
}

async function loadListingRecords(
  scope: AssistantScope,
  read: { query?: string; status?: string; fields?: string[]; maxRecords?: number } = {},
): Promise<AirtableRecord[]> {
  if (!canViewListings(scope)) return [];
  try {
    return await getConfiguredRecords(LISTING_SOURCE, {
      ...(read.query ? { searchQuery: read.query, searchFields: SEARCH_FIELDS } : {}),
      ...(read.status ? { filters: { 'Workflow Status': read.status } } : {}),
      ...(read.fields ? { fields: read.fields } : {}),
      maxRecords: read.maxRecords ?? MAX_SCAN,
    });
  } catch (error) {
    // The listings table is optional context; its failure must not hide workflow results.
    logError('Assistant listing search failed', error);
    return [];
  }
}

function summarizeListing(scope: AssistantScope, record: AirtableRecord) {
  return { id: record.id, kind: 'listing', link: `/listings/${record.id}`, ...pickVisibleFields(scope, record.fields) };
}

function summarize(scope: AssistantScope, record: AirtableRecord) {
  const link = resolveItemLink(scope, record.id, record.fields['Workflow Status']);
  return { id: record.id, ...(link ? { link } : {}), ...pickVisibleFields(scope, record.fields) };
}

type ItemSummary = { id: string; link?: string; [field: string]: unknown };

/** The same record can exist in the workflow and listings tables; report it once and point at both pages. */
export function mergeItemSummaries(workflow: ItemSummary[], listings: ItemSummary[]): ItemSummary[] {
  const listingById = new Map(listings.map((item) => [item.id, item]));
  const merged = workflow.map((item) => {
    const listing = listingById.get(item.id);
    if (!listing) return item;
    listingById.delete(item.id);
    return { ...item, listingLink: listing.link, listingStatus: listing['Workflow Status'], ...(listing.publishReadiness ? { publishReadiness: listing.publishReadiness } : {}) };
  });
  return [...merged, ...listingById.values()];
}

const READINESS_SAMPLE = 1000;
const READINESS_CACHE_MS = 10 * 60 * 1000;
let requiredNamesCache: { at: number; names: CombinedListingsRequiredFieldNames } | null = null;

async function getRequiredNames(): Promise<CombinedListingsRequiredFieldNames> {
  if (requiredNamesCache && Date.now() - requiredNamesCache.at < READINESS_CACHE_MS) return requiredNamesCache.names;
  // Same projection and subset as the listings-readiness summary, so required field names match the Listings page.
  const sample = await getConfiguredRecords(LISTING_SOURCE, { fields: [...APPROVAL_QUEUE_FIELDS], subset: 'listings-page', maxRecords: READINESS_SAMPLE });
  const names = getCombinedListingsRequiredFieldNames(sample);
  requiredNamesCache = { at: Date.now(), names };
  return names;
}

/** What is left before a listing can be published, using the same rules as the Ready for Publishing list. */
export async function describePublishReadiness(record: AirtableRecord): Promise<Record<string, unknown> | undefined> {
  try {
    const names = await getRequiredNames();
    const status = normalizeCombinedWorkflowStatus(record);
    if (isCombinedRecordAlreadyListed(record)) return { state: 'already listed' };
    if (!isCombinedRecordVisibleOnListingsPage(record)) return undefined;
    const sku = getRecordFieldText(record, ['SKU', 'eBay Inventory SKU', 'Shopify Variant 1 SKU', 'Shopify SKU', 'Variant SKU']);
    const shopifyMissing = getMissingRequiredFieldNames(record.fields, names.shopifyRequiredFieldNames);
    const ebayMissing = getMissingRequiredFieldNames(record.fields, names.ebayRequiredFieldNames);
    const ready = isCombinedRecordReadyForPublishing(record, names.combinedRequiredFieldNames, names.shopifyRequiredFieldNames, names.ebayRequiredFieldNames);
    return {
      state: ready ? 'ready to publish' : 'not ready to publish',
      workflowStatus: status,
      ...(sku ? {} : { missingSku: true }),
      ...(shopifyMissing.length > 0 ? { shopifyMissingFields: shopifyMissing } : {}),
      ...(ebayMissing.length > 0 ? { ebayMissingFields: ebayMissing } : {}),
    };
  } catch (error) {
    logError('Assistant readiness check failed', error);
    return undefined;
  }
}

async function withReadiness<T extends { id: string }>(summary: T, record: AirtableRecord): Promise<T & { publishReadiness?: Record<string, unknown> }> {
  const publishReadiness = await describePublishReadiness(record);
  return publishReadiness ? { ...summary, publishReadiness } : summary;
}

const QUERY_NOISE = new Set(['sku', 'skus', 'item', 'items', 'listing', 'listings', 'number', 'no', 'id', 'the', 'for', 'of', '#']);

/** Drops label words the model often adds ("SKU 11750") that no field contains, which would make every search miss. */
export function cleanSearchQuery(query: string): string {
  const terms = query.split(/\s+/).filter(Boolean);
  const kept = terms.filter((term) => !QUERY_NOISE.has(term.toLowerCase().replace(/[:#]+$/g, '')));
  return (kept.length > 0 ? kept : terms).map((term) => term.replace(/^#/, '')).join(' ');
}

/** Few fields keep the DB-side LIKE fast; scanning every whitelisted field times out. */
const SEARCH_FIELDS = ['SKU', 'Variant SKU', 'Shopify SKU', 'Shopify REST Variant 1 SKU', 'eBay Inventory SKU', 'Item Title', 'Make', 'Model'];

function valueText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const text = (value as { text?: unknown }).text;
    return typeof text === 'string' || typeof text === 'number' ? String(text) : JSON.stringify(value);
  }
  return String(value);
}

function matchesQuery(record: AirtableRecord, scope: AssistantScope, query: string): boolean {
  const haystack = Object.values(pickVisibleFields(scope, record.fields)).map((value) => valueText(value).toLowerCase());
  // Every word must appear somewhere, matching how the data store searches.
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((term) => haystack.some((value) => value.includes(term)));
}

export async function runAssistantTool(
  scope: AssistantScope,
  name: string,
  input: Record<string, unknown>,
  context: AssistantToolContext = {},
): Promise<unknown> {
  switch (name) {
    case 'search_items': {
      const query = typeof input.query === 'string' ? cleanSearchQuery(input.query.trim()) : '';
      const status = typeof input.status === 'string' ? input.status.trim() : '';
      const limit = Math.min(Math.max(Number(input.limit) || 10, 1), MAX_RESULTS);
      const matches = (await loadVisibleRecords(scope, { query, status })).filter((record) =>
        (!status || record.fields['Workflow Status'] === status) && (!query || matchesQuery(record, scope, query)));
      const listings = (await loadListingRecords(scope, { query, status })).filter((record) =>
        (!status || record.fields['Workflow Status'] === status) && (!query || matchesQuery(record, scope, query)));
      const items = mergeItemSummaries(
        matches.map((record) => summarize(scope, record)),
        await Promise.all(listings.slice(0, limit).map((record) => withReadiness(summarizeListing(scope, record), record))),
      );
      return { total: items.length, items: items.slice(0, limit) };
    }
    case 'get_item': {
      const recordId = typeof input.record_id === 'string' ? input.record_id.trim() : '';
      if (!/^rec[A-Za-z0-9]{10,}$/.test(recordId)) return { error: 'Invalid record id.' };
      try {
        const record = await getConfiguredRecord(SOURCE, recordId);
        if (!isStatusVisible(scope, record.fields['Workflow Status'])) {
          return { error: 'You do not have access to this item.' };
        }
        return summarize(scope, record);
      } catch {
        // Not a workflow record: it may be a listing.
      }
      if (canViewListings(scope)) {
        try {
          const listing = await getConfiguredRecord(LISTING_SOURCE, recordId);
          return await withReadiness(summarizeListing(scope, listing), listing);
        } catch {
          // fall through
        }
      }
      return { error: 'Item not found.' };
    }
    case 'stage_counts': {
      const counts: Record<string, number> = {};
      for (const record of await loadVisibleRecords(scope, { fields: ['Workflow Status'], maxRecords: COUNT_SCAN })) {
        const status = String(record.fields['Workflow Status'] ?? 'Unknown');
        counts[status] = (counts[status] ?? 0) + 1;
      }
      const listingCounts: Record<string, number> = {};
      for (const record of await loadListingRecords(scope, { fields: ['Workflow Status'], maxRecords: COUNT_SCAN })) {
        const status = String(record.fields['Workflow Status'] ?? 'Unknown');
        listingCounts[status] = (listingCounts[status] ?? 0) + 1;
      }
      return canViewListings(scope) ? { workflow: counts, listings: listingCounts } : counts;
    }
    case 'search_docs': {
      const query = typeof input.query === 'string' ? input.query.trim().slice(0, 300) : '';
      const results = await searchAllKnowledge(scope, query);
      return results.length > 0 ? { results } : { results: [], note: 'No matching documentation found.' };
    }
    case 'propose_intake_item': {
      if (!canDraftIntake(scope)) return { error: 'You do not have access to create intake items.' };
      context.draft = { kind: 'intake', ...await buildDraft('intake', input) };
      return { ...context.draft, note: 'Draft shown to the user with a Create button. It is NOT saved yet.' };
    }
    case 'propose_stage_update': {
      const stage = typeof input.stage === 'string' ? input.stage : '';
      if (!canDraftStage(scope, stage)) return { error: 'You do not have access to that form.' };
      const recordId = typeof input.record_id === 'string' ? input.record_id.trim() : '';
      if (!/^rec[A-Za-z0-9]{10,}$/.test(recordId)) return { error: 'Invalid record id.' };
      try {
        const record = await getConfiguredRecord(SOURCE, recordId);
        if (!isStatusVisible(scope, record.fields['Workflow Status'])) return { error: 'You do not have access to this item.' };
      } catch {
        return { error: 'Item not found.' };
      }
      const kind: DraftKind = stage;
      context.draft = { kind, recordId, ...await buildDraft(kind, input) };
      return { ...context.draft, note: 'Draft shown to the user with Save and Complete buttons. It is NOT saved yet.' };
    }
    case 'search_customers': {
      const denied = requireCustomerAccess(scope);
      if (denied) return { error: denied };
      const query = typeof input.query === 'string' ? input.query.trim().slice(0, 200) : '';
      return { contacts: await listContacts(getPostgresPool(), query, 10) };
    }
    case 'get_customer': {
      const denied = requireCustomerAccess(scope);
      if (denied) return { error: denied };
      const id = typeof input.contact_id === 'string' ? input.contact_id.trim() : '';
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return { error: 'Invalid contact id.' };
      const detail = await getContactDetail(getPostgresPool(), id);
      return detail ? { ...detail, items: withItemLinks(scope, detail.items) } : { error: 'Customer not found.' };
    }
    case 'get_seller_history': {
      const denied = requireCustomerAccess(scope);
      if (denied) return { error: denied };
      const email = typeof input.email === 'string' ? input.email.trim().slice(0, 200) : '';
      if (!email) return { error: 'Email is required.' };
      const history = await getSellerHistory(getPostgresPool(), email);
      return history ? { ...history, items: withItemLinks(scope, history.items) } : { error: 'No seller found for that email.' };
    }
    default:
      return { error: `Unknown tool ${name}.` };
  }
}
