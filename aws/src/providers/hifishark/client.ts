import { load } from 'cheerio';
import { HttpError } from '../../shared/errors.js';

export interface HiFiSharkListing {
  id: string;
  title: string;
  site: string;
  country: string;
  price: string;
  priceNumeric: number | null;
  currency: string;
  listedDate: string;
  url: string;
}

const PRICE_RE =
  /(?:CA\$|AU\$|NZ\$|HK\$|NT\$|[$£€¥])\s*[\d,]+(?:\.\d+)?|[\d,]+(?:\.\d+)?\s*(?:USD|EUR|GBP|JPY|HUF|CZK|KZT|SEK|NOK|DKK|CHF|PLN|RON)/i;

const DATE_RE =
  /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}/;

const KNOWN_COUNTRIES = [
  'Japan', 'Germany', 'Netherlands', 'Italy', 'France', 'Austria', 'Belgium',
  'Switzerland', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Spain', 'Portugal',
  'Poland', 'Czech Republic', 'Slovakia', 'Hungary', 'Romania', 'Slovenia',
  'Croatia', 'Serbia', 'USA', 'Canada', 'Australia', 'New Zealand',
  'Hong Kong', 'Taiwan', 'South Korea', 'Singapore', 'Thailand', 'Malaysia',
  'China', 'Kazakhstan', 'Ukraine', 'Russia', 'UK', 'Ireland',
];

const COUNTRY_NAMES: Record<string, string> = {
  AU: 'Australia',
  BE: 'Belgium',
  CA: 'Canada',
  CH: 'Switzerland',
  CN: 'China',
  CZ: 'Czech Republic',
  DE: 'Germany',
  DK: 'Denmark',
  ES: 'Spain',
  FI: 'Finland',
  FR: 'France',
  HK: 'Hong Kong',
  HU: 'Hungary',
  IE: 'Ireland',
  IT: 'Italy',
  JP: 'Japan',
  KZ: 'Kazakhstan',
  MY: 'Malaysia',
  NL: 'Netherlands',
  NO: 'Norway',
  NZ: 'New Zealand',
  PL: 'Poland',
  PT: 'Portugal',
  RO: 'Romania',
  RU: 'Russia',
  SE: 'Sweden',
  SG: 'Singapore',
  SI: 'Slovenia',
  SK: 'Slovakia',
  TH: 'Thailand',
  TW: 'Taiwan',
  UA: 'Ukraine',
  UK: 'UK',
  US: 'USA',
};

interface HiFiSharkSearchResults {
  hits?: HiFiSharkHit[];
}

interface HiFiSharkHit {
  _id: string;
  description?: string;
  url: string;
  display_date_str?: string;
  display_price?: string;
  original_price_converted?: string;
  location?: {
    country_iso?: string;
  };
  price?: {
    currency_iso?: string;
    value?: number | null;
  };
}

export interface ParseHiFiSharkListingsOptions {
  slug: string;
  html: string;
}

function parseCurrency(price: string): { amount: number | null; currency: string } {
  if (!price) return { amount: null, currency: '' };
  const digits = price.replace(/[^0-9.]/g, '').replace(/\.(?=.*\.)/g, '');
  const amount = digits ? Number.parseFloat(digits) : null;

  let currency = '';
  if (/CA\$/i.test(price)) currency = 'CAD';
  else if (/NT\$/i.test(price)) currency = 'TWD';
  else if (/AU\$/i.test(price)) currency = 'AUD';
  else if (/HK\$/i.test(price)) currency = 'HKD';
  else if (/NZ\$/i.test(price)) currency = 'NZD';
  else if (price.includes('€')) currency = 'EUR';
  else if (price.includes('£')) currency = 'GBP';
  else if (price.includes('¥')) currency = 'JPY';
  else if (price.includes('$')) currency = 'USD';
  else if (/HUF/i.test(price)) currency = 'HUF';
  else if (/CZK/i.test(price)) currency = 'CZK';
  else if (/KZT/i.test(price)) currency = 'KZT';
  else if (/SEK/i.test(price)) currency = 'SEK';
  else if (/NOK/i.test(price)) currency = 'NOK';
  else if (/CHF/i.test(price)) currency = 'CHF';

  return { amount, currency };
}

function extractCountry(text: string): string {
  for (const country of KNOWN_COUNTRIES) {
    if (text.includes(country)) return country;
  }
  return '';
}

function extractSite(text: string): string {
  const match = text.match(/@ ([A-Za-z0-9][A-Za-z0-9 -]+?)(?=\s{2,}|\s[A-Z][a-z]{3,}|\s\d|\s*$)/);
  if (match) return match[1].trim();
  if (/ebay/i.test(text)) return 'eBay';
  return '';
}

function cleanTitle(text: string, price: string, date: string): string {
  let title = text;
  if (price) title = title.replace(price, '');
  if (date) title = title.replace(date, '');
  return title
    .replace(/eBay logo/gi, '')
    .replace(/Auction bid/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase().replace(/\s+/g, '-');
}

function normalizeListingUrl(url: string): string {
  return url.startsWith('http') ? url : `https://www.hifishark.com${url}`;
}

function titleToSite(title: string | undefined): string {
  if (!title) return '';
  const match = title.match(/Click to see this listing on (.+)$/);
  return match ? match[1].trim() : '';
}

function buildSiteNameMap($: ReturnType<typeof load>): Map<string, string> {
  const siteNameMap = new Map<string, string>();

  $('a.search-product-row').each((_, element) => {
    const link = $(element);
    const href = link.attr('href');
    if (!href) return;

    const site = titleToSite(link.attr('title'));
    if (site) {
      siteNameMap.set(normalizeListingUrl(href), site);
    }
  });

  return siteNameMap;
}

function extractAssignedJsonObject(html: string, variableName: string): string | null {
  const marker = `var ${variableName} = `;
  const start = html.indexOf(marker);
  if (start === -1) {
    return null;
  }

  const objectStart = html.indexOf('{', start + marker.length);
  if (objectStart === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let index = objectStart; index < html.length; index += 1) {
    const char = html[index];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (char === '\\') {
        isEscaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return html.slice(objectStart, index + 1);
      }
    }
  }

  return null;
}

function countryFromIso(countryIso: string | undefined): string {
  if (!countryIso) return '';
  return COUNTRY_NAMES[countryIso.toUpperCase()] || countryIso.toUpperCase();
}

function buildListingsFromSearchResults(
  normalizedSlug: string,
  searchResults: HiFiSharkSearchResults,
  siteNameMap: Map<string, string>,
): HiFiSharkListing[] {
  const hits = searchResults.hits ?? [];

  return hits.map((hit, index) => {
    const url = normalizeListingUrl(hit.url);
    const price = hit.display_price && hit.display_price !== '-'
      ? hit.display_price
      : hit.original_price_converted && hit.original_price_converted !== '-'
        ? hit.original_price_converted
        : '';
    const parsedCurrency = parseCurrency(price);

    return {
      id: hit._id || `${normalizedSlug}-${index}`,
      title: (hit.description || '').trim(),
      site: siteNameMap.get(url) || '',
      country: countryFromIso(hit.location?.country_iso),
      price,
      priceNumeric: hit.price?.value ?? parsedCurrency.amount,
      currency: hit.price?.currency_iso || parsedCurrency.currency,
      listedDate: hit.display_date_str || '',
      url,
    };
  });
}

export function parseListingsFromHtml({ slug, html }: ParseHiFiSharkListingsOptions): HiFiSharkListing[] {
  const normalizedSlug = normalizeSlug(slug);
  const $ = load(html);
  const siteNameMap = buildSiteNameMap($);
  const searchResultsJson = extractAssignedJsonObject(html, 'searchResults');

  if (searchResultsJson) {
    try {
      const searchResults = JSON.parse(searchResultsJson) as HiFiSharkSearchResults;
      const structuredListings = buildListingsFromSearchResults(normalizedSlug, searchResults, siteNameMap)
        .filter((listing) => listing.title || listing.site || listing.price || listing.url);

      if (structuredListings.length > 0) {
        return structuredListings;
      }
    } catch {
      // Fall through to DOM parsing if the embedded JSON changes format.
    }
  }

  const results: HiFiSharkListing[] = [];

  $('a[href*="/goto/"], a[href*="yahoo.com"], a[href*="bid.yahoo"]').each((index, element) => {
    const link = $(element);
    const href = link.attr('href') || '';

    if (!href.includes('/goto/') && !href.includes('yahoo')) {
      return;
    }

    const row = link.closest('tr');
    let fullText = '';
    let site = '';
    let priceText = '';
    let dateText = '';

    if (row.length > 0) {
      const cells = row.find('td').toArray();
      fullText = cells.map((cell) => $(cell).text().trim()).join(' ');

      if (cells[1]) {
        const siteCell = $(cells[1]);
        site = siteCell.find('img').attr('alt') || siteCell.text().trim() || '';
      }
      if (cells[2]) priceText = $(cells[2]).text().trim();
      if (cells[3]) dateText = $(cells[3]).text().trim();
    } else {
      fullText = link.text().trim();
    }

    if (!fullText) {
      return;
    }

    if (!priceText) {
      const match = fullText.match(PRICE_RE);
      priceText = match ? match[0].trim() : '';
    }
    if (!dateText) {
      const match = fullText.match(DATE_RE);
      dateText = match ? match[0].trim() : '';
    }

    const { amount, currency } = parseCurrency(priceText);
    const country = extractCountry(fullText);
    if (!site) {
      site = extractSite(fullText);
    }

    const rawTitle = row.length > 0
      ? row.find('td:first-child a').first().text().trim() || fullText
      : fullText;
    const title = cleanTitle(rawTitle, priceText, dateText);
    const listingUrl = normalizeListingUrl(href);

    results.push({
      id: `${normalizedSlug}-${index}`,
      title,
      site,
      country,
      price: priceText,
      priceNumeric: amount,
      currency,
      listedDate: dateText,
      url: listingUrl,
    });
  });

  return results;
}

export async function getListingsForSlug(slug: string): Promise<HiFiSharkListing[]> {
  const normalizedSlug = normalizeSlug(slug);
  if (!normalizedSlug) {
    throw new HttpError(400, 'slug is required', {
      service: 'hifishark',
      code: 'MISSING_HIFISHARK_SLUG',
      retryable: false,
    });
  }

  const url = `https://www.hifishark.com/model/${encodeURIComponent(normalizedSlug)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) {
    throw new HttpError(response.status, `HiFiShark fetch failed: HTTP ${response.status}`, {
      service: 'hifishark',
      code: 'HIFISHARK_HTTP_ERROR',
      retryable: response.status >= 500,
    });
  }

  const html = await response.text();
  return parseListingsFromHtml({ slug: normalizedSlug, html });
}