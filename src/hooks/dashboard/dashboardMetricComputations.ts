import { formatAnswer } from '@/services/jotform';
import { AirtableRecord } from '@/types/airtable';
import { JotFormSubmission } from '@/types/jotform';
import { isWithinWindow, parseCurrencyAmount, parseDateValue } from '@/hooks/dashboard/metricUtils';
import type { ShopifyProductFull } from '@/hooks/dashboard/metricsTypes';

export interface MetricWindows {
  now: number;
  current30dStart: number;
  previous30dStart: number;
  current7dStart: number;
}

export interface SubmissionMetrics {
  thisWeekSubs: JotFormSubmission[];
  recentSubs: JotFormSubmission[];
  priorRecentSubs: JotFormSubmission[];
  submissionDays: Array<{ label: string; count: number }>;
  maxDayCount: number;
  topBrands: Array<[string, number]>;
}

export interface ProductSlices {
  draftProducts: ShopifyProductFull[];
  activeProducts: ShopifyProductFull[];
  archivedProducts: ShopifyProductFull[];
  recentDraftProducts: ShopifyProductFull[];
  priorDraftProducts: ShopifyProductFull[];
  recentArchivedProducts: ShopifyProductFull[];
  priorArchivedProducts: ShopifyProductFull[];
}

export interface ValueMetrics {
  inventoryValue: number;
  recentInventoryValue: number;
  priorInventoryValue: number;
  avgAskPrice: number;
  sellThroughPct: number | null;
  acquisitionCost: number;
  recentAcquisitionCost: number;
  priorAcquisitionCost: number;
  grossMarginPct: number | null;
  recentMarginPct: number;
  priorMarginPct: number;
  airtableInventoryValue: number;
}

export interface AirtableDistributionMetrics {
  uniqueAirtableBrands: number;
  uniqueAirtableTypes: number;
  componentTypeSummary: Array<[string, number]>;
  airtableBrandSummary: Array<[string, number]>;
  airtableDistributorSummary: Array<[string, { count: number; total: number }]>;
  airtableTypeTable: Array<{
    type: string;
    count: number;
    brandCount: number;
    averagePrice: number;
    totalPrice: number;
  }>;
  maxComponentTypeCount: number;
  maxAirtableBrandCount: number;
}

export function createMetricWindows(now: number): MetricWindows {
  const MS_30D = 30 * 24 * 60 * 60 * 1000;
  const MS_7D = 7 * 24 * 60 * 60 * 1000;

  return {
    now,
    current30dStart: now - MS_30D,
    previous30dStart: now - (MS_30D * 2),
    current7dStart: now - MS_7D,
  };
}

function getPrimaryVariantPrice(product: ShopifyProductFull): number {
  return parseFloat(product.variants?.[0]?.price ?? '0') || 0;
}

function getPrimaryVariantQuantity(product: ShopifyProductFull): number {
  return Math.max(product.variants?.[0]?.inventory_quantity ?? 1, 1);
}

function buildSubmissionDays(jfSubmissions: JotFormSubmission[], now: number): Array<{ label: string; count: number }> {
  return Array.from({ length: 14 }, (_, i) => {
    const date = new Date(now - (13 - i) * 24 * 60 * 60 * 1000);
    const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const count = jfSubmissions.filter((submission) => {
      const submissionDate = new Date(submission.created_at);
      return submissionDate.toDateString() === date.toDateString();
    }).length;
    return { label, count };
  });
}

function summarizeTopBrands(jfSubmissions: JotFormSubmission[]): Array<[string, number]> {
  const brandCounts: Record<string, number> = {};

  jfSubmissions.slice(0, 500).forEach((submission) => {
    const brandAnswer = Object.values(submission.answers).find((answer) => /brand/i.test(answer.text || '') || /brand/i.test(answer.name || ''));
    const brand = formatAnswer(brandAnswer?.answer)?.trim();
    if (brand && brand.length < 50) {
      brandCounts[brand] = (brandCounts[brand] || 0) + 1;
    }
  });

  return Object.entries(brandCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
}

export function computeSubmissionMetrics(jfSubmissions: JotFormSubmission[], windows: MetricWindows): SubmissionMetrics {
  const recentSubs = jfSubmissions.filter((submission) => windows.now - new Date(submission.created_at).getTime() < 30 * 24 * 60 * 60 * 1000);
  const thisWeekSubs = jfSubmissions.filter((submission) => windows.now - new Date(submission.created_at).getTime() < 7 * 24 * 60 * 60 * 1000);
  const priorRecentSubs = jfSubmissions.filter((submission) => {
    const createdAt = parseDateValue(submission.created_at);
    return isWithinWindow(createdAt, windows.previous30dStart, windows.current30dStart);
  });

  const submissionDays = buildSubmissionDays(jfSubmissions, windows.now);
  const maxDayCount = Math.max(...submissionDays.map((day) => day.count), 1);

  return {
    thisWeekSubs,
    recentSubs,
    priorRecentSubs,
    submissionDays,
    maxDayCount,
    topBrands: summarizeTopBrands(jfSubmissions),
  };
}

export function sliceProducts(products: ShopifyProductFull[], windows: MetricWindows): ProductSlices {
  const draftProducts = products.filter((product) => product.status === 'draft');
  const activeProducts = products.filter((product) => product.status === 'active');
  const archivedProducts = products.filter((product) => product.status === 'archived');

  return {
    draftProducts,
    activeProducts,
    archivedProducts,
    recentDraftProducts: draftProducts.filter((product) => isWithinWindow(parseDateValue(product.created_at), windows.current30dStart, windows.now)),
    priorDraftProducts: draftProducts.filter((product) => isWithinWindow(parseDateValue(product.created_at), windows.previous30dStart, windows.current30dStart)),
    recentArchivedProducts: archivedProducts.filter((product) => isWithinWindow(parseDateValue(product.updated_at), windows.current30dStart, windows.now)),
    priorArchivedProducts: archivedProducts.filter((product) => isWithinWindow(parseDateValue(product.updated_at), windows.previous30dStart, windows.current30dStart)),
  };
}

export function computeValueMetrics(
  nonEmptyListings: AirtableRecord[],
  products: ShopifyProductFull[],
  slices: ProductSlices,
  windows: MetricWindows,
): ValueMetrics {
  const inventoryValue = products.reduce((sum, product) => {
    if (product.status !== 'active') return sum;
    return sum + getPrimaryVariantPrice(product) * getPrimaryVariantQuantity(product);
  }, 0);

  const recentInventoryValue = slices.activeProducts.reduce((sum, product) => {
    if (!isWithinWindow(parseDateValue(product.created_at), windows.current30dStart, windows.now)) return sum;
    return sum + getPrimaryVariantPrice(product) * getPrimaryVariantQuantity(product);
  }, 0);

  const priorInventoryValue = slices.activeProducts.reduce((sum, product) => {
    if (!isWithinWindow(parseDateValue(product.created_at), windows.previous30dStart, windows.current30dStart)) return sum;
    return sum + getPrimaryVariantPrice(product) * getPrimaryVariantQuantity(product);
  }, 0);

  const acquisitionCost = nonEmptyListings.reduce((sum, listing) => {
    return sum + parseCurrencyAmount(listing.fields.Price ?? listing.fields['Purchase Price'] ?? listing.fields.Cost);
  }, 0);

  const recentAcquisitionCost = nonEmptyListings.reduce((sum, listing) => {
    if (!isWithinWindow(parseDateValue(listing.createdTime), windows.current30dStart, windows.now)) return sum;
    return sum + parseCurrencyAmount(listing.fields.Price ?? listing.fields['Purchase Price'] ?? listing.fields.Cost);
  }, 0);

  const priorAcquisitionCost = nonEmptyListings.reduce((sum, listing) => {
    if (!isWithinWindow(parseDateValue(listing.createdTime), windows.previous30dStart, windows.current30dStart)) return sum;
    return sum + parseCurrencyAmount(listing.fields.Price ?? listing.fields['Purchase Price'] ?? listing.fields.Cost);
  }, 0);

  const avgAskPrice = slices.activeProducts.length
    ? slices.activeProducts.reduce((sum, product) => sum + getPrimaryVariantPrice(product), 0) / slices.activeProducts.length
    : 0;

  const sellThroughPct = products.length ? Math.round((slices.archivedProducts.length / products.length) * 100) : null;

  const profitableItems = slices.activeProducts.filter((product) => getPrimaryVariantPrice(product) > 0);
  const totalAsk = profitableItems.reduce((sum, product) => sum + getPrimaryVariantPrice(product), 0);
  const grossMarginPct = acquisitionCost > 0 && totalAsk > 0
    ? Math.round(((totalAsk - acquisitionCost) / totalAsk) * 100)
    : null;

  const recentAskValue = slices.activeProducts.reduce((sum, product) => {
    if (!isWithinWindow(parseDateValue(product.created_at), windows.current30dStart, windows.now)) return sum;
    return sum + getPrimaryVariantPrice(product);
  }, 0);

  const priorAskValue = slices.activeProducts.reduce((sum, product) => {
    if (!isWithinWindow(parseDateValue(product.created_at), windows.previous30dStart, windows.current30dStart)) return sum;
    return sum + getPrimaryVariantPrice(product);
  }, 0);

  const recentMarginPct = recentAcquisitionCost > 0 && recentAskValue > 0
    ? Math.round(((recentAskValue - recentAcquisitionCost) / recentAskValue) * 100)
    : 0;

  const priorMarginPct = priorAcquisitionCost > 0 && priorAskValue > 0
    ? Math.round(((priorAskValue - priorAcquisitionCost) / priorAskValue) * 100)
    : 0;

  return {
    inventoryValue,
    recentInventoryValue,
    priorInventoryValue,
    avgAskPrice,
    sellThroughPct,
    acquisitionCost,
    recentAcquisitionCost,
    priorAcquisitionCost,
    grossMarginPct,
    recentMarginPct,
    priorMarginPct,
    airtableInventoryValue: nonEmptyListings.reduce((sum, listing) => sum + parseCurrencyAmount(listing.fields.Price), 0),
  };
}

export function computeAirtableDistributionMetrics(nonEmptyListings: AirtableRecord[]): AirtableDistributionMetrics {
  const uniqueAirtableBrands = new Set(
    nonEmptyListings
      .map((listing) => String(listing.fields.Brand ?? '').trim())
      .filter(Boolean),
  ).size;

  const uniqueAirtableTypes = new Set(
    nonEmptyListings
      .map((listing) => String(listing.fields['Component Type'] ?? '').trim())
      .filter(Boolean),
  ).size;

  const componentTypeSummary = Object.entries(
    nonEmptyListings.reduce<Record<string, number>>((acc, listing) => {
      const key = String(listing.fields['Component Type'] ?? 'Uncategorized').trim() || 'Uncategorized';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const airtableBrandSummary = Object.entries(
    nonEmptyListings.reduce<Record<string, number>>((acc, listing) => {
      const key = String(listing.fields.Brand ?? 'Unknown').trim() || 'Unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const airtableDistributorSummary = Object.entries(
    nonEmptyListings.reduce<Record<string, { count: number; total: number }>>((acc, listing) => {
      const distributor = String(listing.fields.Distributor ?? 'Unknown').trim() || 'Unknown';
      const price = parseCurrencyAmount(listing.fields.Price);
      if (!acc[distributor]) {
        acc[distributor] = { count: 0, total: 0 };
      }
      acc[distributor].count += 1;
      acc[distributor].total += price;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8);

  const airtableTypeTable = Object.entries(
    nonEmptyListings.reduce<Record<string, { count: number; total: number; brands: Set<string> }>>((acc, listing) => {
      const type = String(listing.fields['Component Type'] ?? 'Uncategorized').trim() || 'Uncategorized';
      const brand = String(listing.fields.Brand ?? '').trim();
      const price = parseCurrencyAmount(listing.fields.Price);
      if (!acc[type]) {
        acc[type] = { count: 0, total: 0, brands: new Set<string>() };
      }
      acc[type].count += 1;
      acc[type].total += price;
      if (brand) acc[type].brands.add(brand);
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([type, summary]) => ({
      type,
      count: summary.count,
      brandCount: summary.brands.size,
      averagePrice: summary.count ? summary.total / summary.count : 0,
      totalPrice: summary.total,
    }));

  return {
    uniqueAirtableBrands,
    uniqueAirtableTypes,
    componentTypeSummary,
    airtableBrandSummary,
    airtableDistributorSummary,
    airtableTypeTable,
    maxComponentTypeCount: Math.max(...componentTypeSummary.map(([, count]) => count), 1),
    maxAirtableBrandCount: Math.max(...airtableBrandSummary.map(([, count]) => count), 1),
  };
}