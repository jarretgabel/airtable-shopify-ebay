export type AirtableFields = Record<string, unknown>;

export interface ContactRow {
  email: string;
  phone: string | null;
  zipCode: string | null;
  location: string | null;
  mailingListOptIn: boolean;
  howDidYouHear: string | null;
}

export interface ItemRow {
  sku: string | null;
  make: string | null;
  model: string | null;
  serialNumber: string | null;
  componentType: string[] | null;
  condition: string | null;
  cost: number | null;
  offerAmount: number | null;
  paidAmount: number | null;
  arrivalDate: string | null;
  workflowStatus: string | null;
  workflowSource: string | null;
  jotformSubmissionId: string | null;
  vendor: string | null;
  shopifyOrderId: string | null;
  shopifyOrderName: string | null;
  postSaleOutcome: string | null;
  postSaleOutcomeAt: string | null;
  refundAmount: number | null;
  refundReason: string | null;
  returnReceivedAt: string | null;
  restockDisposition: string | null;
}

export interface ListingRow {
  channel: 'ebay' | 'shopify';
  status: 'draft' | 'published' | 'closed';
  price: number | null;
  quantity: number | null;
  externalProductId: string | null;
  externalOfferId: string | null;
  publishedAt: string | null;
  closedAt: string | null;
  closeResult: string | null;
}

export interface StatusHistoryRow {
  status: string;
  changedAt: string;
  changedBy: string | null;
}

export interface ImageRow {
  position: number;
  attachment: unknown;
  altText: string | null;
  role: string | null;
}

export interface NormalizedListing {
  contact: ContactRow | null;
  item: ItemRow;
  listings: ListingRow[];
  statusHistory: StatusHistoryRow[];
  images: ImageRow[];
}

export function text(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (value && typeof value === 'object') {
    // Computed and AI fields arrive as { text } or { value }.
    const inner = (value as { text?: unknown; value?: unknown }).text ?? (value as { value?: unknown }).value;
    if (inner !== undefined && inner !== value) return text(inner);
  }
  return null;
}

export function num(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,\s]/g, '');
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

// Accepts full ISO timestamps and date-only strings (Airtable uses both); date-only means midnight UTC.
export function timestamp(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00.000Z` : raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function dateOnly(value: unknown): string | null {
  const iso = timestamp(value);
  return iso ? iso.slice(0, 10) : null;
}

function stringList(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const items = value.map(text).filter((item): item is string => item !== null);
    return items.length > 0 ? items : null;
  }
  const single = text(value);
  return single ? [single] : null;
}

// US-style 10-digit key; shorter numbers (partial or mistyped) are not trusted for matching.
export function phoneKey(value: unknown): string | null {
  const digits = (text(value) ?? '').replace(/\D/g, '');
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return national.length === 10 ? national : null;
}

export function normalizeEmail(value: unknown): string | null {
  const email = text(value)?.toLowerCase() ?? null;
  return email && email.includes('@') ? email : null;
}

// Workflow milestones recorded as timestamp fields; history before migration can only be rebuilt from these.
const STATUS_MILESTONES: Array<{ status: string; at: string; by?: string }> = [
  { status: 'Accepted', at: 'Accepted At', by: 'Accepted By' },
  { status: 'Processing Signed', at: 'Processing Signed At', by: 'Processing Signed By' },
  { status: 'Testing Signed', at: 'Testing Signed At', by: 'Testing Signed By' },
  { status: 'Photography Signed', at: 'Photography Signed At', by: 'Photography Signed By' },
  { status: 'Pre-Listing Reviewed', at: 'Pre-Listing Reviewed At', by: 'Pre-Listing Reviewed By' },
  { status: 'Awaiting Pre-Listing Review', at: 'Awaiting Pre-Listing Review At' },
  { status: 'Approved For Publish', at: 'Approved For Publish At' },
  { status: 'Listed', at: 'Listed At' },
  { status: 'Stale Listing', at: 'Stale Listing At' },
  { status: 'Sold Ready To Ship', at: 'Sold Ready To Ship At' },
  { status: 'Shipped', at: 'Shipped At' },
];

function mapContact(fields: AirtableFields): ContactRow | null {
  const email = normalizeEmail(fields['Seller Email']);
  if (!email) return null;
  return {
    email,
    phone: text(fields['Seller Phone']),
    zipCode: text(fields['Seller Zip Code']),
    location: text(fields['Seller Location']),
    mailingListOptIn: fields['Mailing List Opt In'] === true,
    howDidYouHear: text(fields['How Did You Hear']),
  };
}

function mapListings(fields: AirtableFields): ListingRow[] {
  const rows: ListingRow[] = [];

  const ebay = {
    price: num(fields['Ebay Price']),
    offerId: text(fields['eBay Offer ID']),
    listingId: text(fields['eBay Listing ID']),
    publishedAt: timestamp(fields['eBay Published At']),
    closedAt: timestamp(fields['eBay Closed At']),
    closeResult: text(fields['eBay Close Result']),
  };
  if (Object.values(ebay).some((value) => value !== null)) {
    rows.push({
      channel: 'ebay',
      status: ebay.closedAt ? 'closed' : ebay.publishedAt || ebay.listingId ? 'published' : 'draft',
      price: ebay.price,
      quantity: null,
      externalProductId: ebay.listingId,
      externalOfferId: ebay.offerId,
      publishedAt: ebay.publishedAt,
      closedAt: ebay.closedAt,
      closeResult: ebay.closeResult,
    });
  }

  const shopify = {
    price: num(fields['Shopify Price']),
    productId: text(fields['Shopify REST Product ID']),
    quantity: num(fields['Shopify Inventory Quantity']),
    closedAt: timestamp(fields['Shopify Closed At']),
    closeResult: text(fields['Shopify Close Result']),
  };
  if (Object.values(shopify).some((value) => value !== null)) {
    rows.push({
      channel: 'shopify',
      status: shopify.closedAt ? 'closed' : shopify.productId ? 'published' : 'draft',
      price: shopify.price,
      quantity: shopify.quantity === null ? null : Math.trunc(shopify.quantity),
      externalProductId: shopify.productId,
      externalOfferId: null,
      publishedAt: null,
      closedAt: shopify.closedAt,
      closeResult: shopify.closeResult,
    });
  }

  return rows;
}

function mapStatusHistory(fields: AirtableFields): StatusHistoryRow[] {
  const rows: StatusHistoryRow[] = [];
  for (const milestone of STATUS_MILESTONES) {
    const changedAt = timestamp(fields[milestone.at]);
    if (!changedAt) continue;
    rows.push({
      status: milestone.status,
      changedAt,
      changedBy: milestone.by ? text(fields[milestone.by]) : null,
    });
  }
  return rows.sort((a, b) => a.changedAt.localeCompare(b.changedAt));
}

function mapImages(fields: AirtableFields): ImageRow[] {
  const images = fields.Images;
  if (!Array.isArray(images)) return [];
  return images
    .filter((attachment) => attachment && typeof attachment === 'object')
    .map((attachment, index) => ({ position: index, attachment, altText: null, role: null }));
}

export function normalizeListing(fields: AirtableFields): NormalizedListing {
  return {
    contact: mapContact(fields),
    item: {
      sku: text(fields.SKU),
      make: text(fields.Make),
      model: text(fields.Model),
      serialNumber: text(fields['Serial Number']),
      componentType: stringList(fields['Component Type']),
      condition: text(fields.Condition),
      cost: num(fields.Cost),
      offerAmount: num(fields['Offer Amount']),
      paidAmount: num(fields['Paid Amount']),
      arrivalDate: dateOnly(fields['Arrival Date']),
      workflowStatus: text(fields['Workflow Status']),
      workflowSource: text(fields['Workflow Source']),
      jotformSubmissionId: text(fields['JotForm Submission ID']),
      vendor: text(fields.Vendor),
      shopifyOrderId: text(fields['Shopify Order ID']),
      shopifyOrderName: text(fields['Shopify Order Name']),
      postSaleOutcome: text(fields['Post-Sale Outcome']),
      postSaleOutcomeAt: timestamp(fields['Post-Sale Outcome At']),
      refundAmount: num(fields['Refund Amount']),
      refundReason: text(fields['Refund Reason']),
      returnReceivedAt: timestamp(fields['Return Received At']),
      restockDisposition: text(fields['Restock Disposition']),
    },
    listings: mapListings(fields),
    statusHistory: mapStatusHistory(fields),
    images: mapImages(fields),
  };
}
