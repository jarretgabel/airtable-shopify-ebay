import { hasFullAccessRole, type UserRole } from '../../../shared/appPages.js';
import { USED_GEAR_PROGRESS_STATUS_VALUES } from '../../../shared/contracts/usedGearWorkflowSubsets.js';

export const TESTING_STATUS = 'Testing In Progress';
export const PHOTOGRAPHY_STATUS = 'Photography In Progress';

export interface AssistantUser {
  role: UserRole;
  allowedPages: string[];
}

export interface AssistantScope {
  role: UserRole;
  fullAccess: boolean;
  /** Workflow Status values the user may see; null means every status. */
  statuses: string[] | null;
  fields: string[];
  pages: string[];
  canViewFinance: boolean;
}

export const BASE_FIELDS = [
  'Make', 'Model', 'Component Type', 'Serial Number', 'SKU', 'Workflow Status', 'Condition',
  'Cosmetic Notes', 'Inventory Notes', 'Includes', 'Original Box', 'Manual',
  'Remote', 'Power Cable', 'Additional Items', 'Voltage', 'Weight', 'Arrival Date', 'Pick Up ID', 'Pick Up #', 'Status', "Photo'd",
  'Audiogon Rating', 'Shipping Weight', 'Shipping Dims', 'Shipping Method',
  'Testing Notes', 'Testing Cosmetic Notes', 'Testing Time', 'Service Notes', 'Service Time', 'Tested', 'Testing Signed At', 'Testing Signed By',
  'Photography Cosmetic Notes', 'Photography Signed At', 'Photography Signed By',
];
export const LISTING_FIELDS = [
  'Item Title', 'Title', 'Shopify Title', 'Shopify REST Title', 'eBay Title', 'eBay Inventory Product Title', 'Vendor',
  'Ebay Listing Format', 'Description', 'Shopify Type', 'Shopify Collections', 'Shopify Tags',
  'Approved For Publish At', 'Awaiting Pre-Listing Review At', 'Pre-Listing Reviewed At', 'Pre-Listing Reviewed By', 'eBay Listing ID', 'eBay Published At', 'Shopify Status', 'Shopify REST Status', 'eBay Offer Status', 'eBay Format', 'Listing Format',
  'Shopify Price', 'Shopify REST Variant 1 Price', 'Shopify Variant 1 Price', 'eBay Price', 'Ebay Price', 'Buy It Now Price',
  'Starting Auction Price', 'Quantity', 'Qty', 'eBay Inventory SKU', 'Shopify REST Variant 1 SKU', 'Condition',
];
export const POST_PUBLISH_FIELDS = [
  'Workflow Owner', 'Sold At', 'Sold Via', 'Sale Order', 'Shopify Closed At', 'eBay Closed At', 'Listed At', 'Stale Listing At', 'Stale Recovery Status', 'Stale Recovery Notes', 'Relisted At',
  'Sold Ready To Ship At', 'Shipped At', 'Post-Sale Outcome', 'Post-Sale Outcome At', 'Post-Sale Notes',
  'Return Received At', 'Restock Disposition',
];
export const FINANCE_FIELDS = ['Cost', 'Refund Amount', 'Refund Reason'];
export const SELLER_FIELDS = [
  'Sale Price', 'Buyer Name', 'Buyer Email', 'Buyer Phone', 'Buyer Ship To', 'Accepted At', 'Accepted By',
  'Acquired From', 'Original Owner', 'Seller Email', 'Seller Phone', 'Seller Location', 'Seller Zip Code',
  'How Did You Hear', 'Mailing List Opt In', 'Customer Cosmetic Notes', 'Customer Functional Notes',
  'Customer Inclusion Notes', 'Smoke Exposure',
];

/** Mirrors the app: what each role's pages show decides what the assistant may read. */
export function resolveAssistantScope(user: AssistantUser): AssistantScope {
  const fullAccess = hasFullAccessRole(user.role);
  const pages = new Set(user.allowedPages);

  let statuses: string[] | null = null;
  if (!fullAccess && !pages.has('inventory')) {
    const allowed = new Set<string>();
    if (pages.has('testing-queue') || pages.has('testing')) allowed.add(TESTING_STATUS);
    if (pages.has('photography-queue') || pages.has('photos')) allowed.add(PHOTOGRAPHY_STATUS);
    statuses = [...allowed];
  }

  const fields = [...BASE_FIELDS];
  if (fullAccess || pages.has('listings')) fields.push(...LISTING_FIELDS);
  if (fullAccess || pages.has('post-publish')) fields.push(...POST_PUBLISH_FIELDS);
  if (fullAccess) fields.push(...FINANCE_FIELDS, ...SELLER_FIELDS);
  return { role: user.role, fullAccess, statuses, fields, pages: [...pages], canViewFinance: fullAccess };
}

export function isStatusVisible(scope: AssistantScope, status: unknown): boolean {
  if (scope.statuses === null) return true;
  return typeof status === 'string' && scope.statuses.includes(status);
}

export function isProgressOnlyScope(scope: AssistantScope): boolean {
  return scope.statuses !== null
    && scope.statuses.every((status) => (USED_GEAR_PROGRESS_STATUS_VALUES as readonly string[]).includes(status));
}

/** Some fields (such as SKU) are stored as { text } objects; the model and search should see plain text. */
export function flattenTextValue(value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value);
    const text = (value as { text?: unknown }).text;
    if (keys.every((key) => key === 'text' || key === 'state') && (typeof text === 'string' || typeof text === 'number')) return String(text);
  }
  return value;
}

export function pickVisibleFields(scope: AssistantScope, fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const name of scope.fields) {
    const value = fields[name];
    if (value === undefined || value === null || value === '') continue;
    const plain = flattenTextValue(value);
    out[name] = typeof plain === 'string' && plain.length > 400 ? `${plain.slice(0, 400)}…` : plain;
  }
  return out;
}

/** In-app page for an item, chosen from the pages this user can open. */
export function resolveItemLink(scope: AssistantScope, recordId: string, status: unknown): string | undefined {
  const pages = new Set(scope.pages);
  const id = encodeURIComponent(recordId);
  if (status === TESTING_STATUS && pages.has('testing')) return `/testing/${id}`;
  if (status === PHOTOGRAPHY_STATUS && pages.has('photos')) return `/photography/${id}`;
  if (pages.has('inventory')) return `/workflow-hub/${id}`;
  return undefined;
}

// Mirrors PAGE_DEFINITIONS in src/auth/pages.ts so the assistant can link to pages the user may open.
const PAGE_LINKS: Record<string, { label: string; path: string }> = {
  dashboard: { label: 'Dashboard', path: '/dashboard' },
  sales: { label: 'Sales', path: '/sales' },
  people: { label: 'People', path: '/people' },
  'workflow-guide': { label: 'User Guide', path: '/workflow-guide' },
  'manual-intake': { label: 'Manual Intake', path: '/manual-intake' },
  'create-intake-item': { label: 'Create Intake Item', path: '/create-intake-item' },
  jotform: { label: 'JotForm', path: '/jotform' },
  inventory: { label: 'Workflow Hub', path: '/workflow-hub' },
  listings: { label: 'Listings', path: '/listings' },
  'post-publish': { label: 'Post-Publish', path: '/post-publish' },
  archive: { label: 'Completed Shipments', path: '/completed-shipments' },
  shopify: { label: 'Shopify Products', path: '/shopify' },
  ebay: { label: 'eBay', path: '/ebay' },
  market: { label: 'Market Prices', path: '/market' },
  'parking-lot': { label: 'Parking Lot', path: '/parking-lot' },
  'trash-review': { label: 'Trash Review', path: '/trash-review' },
  'testing-queue': { label: 'Testing Queue', path: '/testing' },
  'photography-queue': { label: 'Photography Queue', path: '/photography' },
  imagelab: { label: 'Image Lab', path: '/imagelab' },
};

export function listAccessiblePageLinks(scope: AssistantScope): Array<{ label: string; path: string }> {
  return scope.pages.filter((page) => page in PAGE_LINKS).map((page) => PAGE_LINKS[page]);
}

/** Accepts only an in-app path from the client; anything else is dropped. */
export function sanitizeCurrentPath(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const path = raw.trim();
  return /^\/[A-Za-z0-9/_\-.]{0,200}$/.test(path) ? path : undefined;
}
