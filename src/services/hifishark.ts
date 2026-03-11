import type { HiFiSharkListing } from '@/types/hifishark';

// Matches common currency formats: €3,000 | £3,033 | $3,913 | ¥458,000 | CA$6,152 | NT$98,000 | HUF 1,750,000
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

function parseCurrency(price: string): { amount: number | null; currency: string } {
  if (!price) return { amount: null, currency: '' };
  const digits = price.replace(/[^0-9.]/g, '').replace(/\.(?=.*\.)/g, '');
  const amount = digits ? parseFloat(digits) : null;

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
  // "@ SiteName" pattern
  const m = text.match(/@ ([A-Za-z0-9][A-Za-z0-9 \-]+?)(?=\s{2,}|\s[A-Z][a-z]{3,}|\s\d|\s*$)/);
  if (m) return m[1].trim();
  // eBay fallback
  if (/ebay/i.test(text)) return 'eBay';
  return '';
}

function cleanTitle(text: string, price: string, date: string): string {
  let title = text;
  if (price) title = title.replace(price, '');
  if (date) title = title.replace(date, '');
  title = title
    .replace(/eBay logo/gi, '')
    .replace(/Auction bid/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return title;
}

export async function scrapeHiFiShark(slug: string): Promise<HiFiSharkListing[]> {
  const res = await fetch(`/hifishark-proxy/model/${encodeURIComponent(slug)}`, {
    headers: { Accept: 'text/html' },
  });

  if (!res.ok) {
    throw new Error(`HiFiShark fetch failed: HTTP ${res.status}`);
  }

  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // All listing links pass through /goto/
  const links = Array.from(
    doc.querySelectorAll('a[href*="/goto/"], a[href*="yahoo.com"], a[href*="bid.yahoo"]')
  ) as HTMLAnchorElement[];

  const results: HiFiSharkListing[] = [];

  links.forEach((link, i) => {
    const href = link.getAttribute('href') || '';
    // Skip internal nav links
    if (!href.includes('/goto/') && !href.includes('yahoo')) return;

    // Gather text from the link and its table row siblings for full context
    const row = link.closest('tr');
    let fullText = '';
    let site = '';
    let priceText = '';
    let dateText = '';

    if (row) {
      const cells = Array.from(row.querySelectorAll('td'));
      fullText = cells.map((c) => c.textContent?.trim()).join(' ');

      // Cell 0 = product title, Cell 1 = site, Cell 2 = price, Cell 3 = date
      if (cells[1]) {
        const img = cells[1].querySelector('img');
        site = img?.getAttribute('alt') || cells[1].textContent?.trim() || '';
      }
      if (cells[2]) priceText = cells[2].textContent?.trim() || '';
      if (cells[3]) dateText = cells[3].textContent?.trim() || '';
    } else {
      // Fallback: parse from link text alone
      fullText = link.textContent?.trim() || '';
    }

    if (!fullText) return;

    // Use cell values if available, else regex-extract from full text
    if (!priceText) {
      const m = fullText.match(PRICE_RE);
      priceText = m ? m[0].trim() : '';
    }
    if (!dateText) {
      const m = fullText.match(DATE_RE);
      dateText = m ? m[0].trim() : '';
    }

    const { amount, currency } = parseCurrency(priceText);
    const country = extractCountry(fullText);
    if (!site) site = extractSite(fullText);

    // Build a clean title from the first cell or link text
    let title = row
      ? (row.querySelector('td:first-child a')?.textContent?.trim() || fullText)
      : fullText;
    title = cleanTitle(title, priceText, dateText);

    const url = href.startsWith('http')
      ? href
      : `https://www.hifishark.com${href}`;

    results.push({
      id: `${slug}-${i}`,
      title,
      site,
      country,
      price: priceText,
      priceNumeric: amount,
      currency,
      listedDate: dateText,
      url,
    });
  });

  return results;
}
