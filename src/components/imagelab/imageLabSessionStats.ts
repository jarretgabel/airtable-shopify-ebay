import type { ImageItem, ImageLabSessionStats } from '@/components/imagelab/types';

function parsePriceRange(value: string): [number, number] | null {
  if (!value || value.toLowerCase() === 'unknown') return null;

  const numbers = [...value.matchAll(/\$?([\d,]+)/g)]
    .map((match) => parseInt(match[1].replace(/,/g, ''), 10))
    .filter((number) => !Number.isNaN(number));

  if (numbers.length >= 2) return [numbers[0], numbers[1]];
  if (numbers.length === 1) return [numbers[0], numbers[0]];
  return null;
}

function formatUsdCompact(value: number): string {
  return value >= 1000 ? `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k` : `$${value}`;
}

export function buildImageLabSessionStats(items: ImageItem[]): ImageLabSessionStats {
  const identified = items.filter((item) => item.aiResult);
  const processed = items.filter((item) => item.processed);

  const brands = [...new Set(identified.map((item) => item.aiResult!.brand).filter((brand) => brand && brand.toLowerCase() !== 'unknown'))];
  const savedBytes = processed.reduce((sum, item) => sum + (item.file.size - (item.processed?.processedBytes ?? item.file.size)), 0);

  let estLow = 0;
  let estHigh = 0;
  let hasPricing = false;

  for (const item of identified) {
    const range = parsePriceRange(item.aiResult!.price_range_sold ?? '');
    if (!range) continue;

    estLow += range[0];
    estHigh += range[1];
    hasPricing = true;
  }

  return {
    total: items.length,
    identified: identified.length,
    processed: processed.length,
    brands,
    savedBytes,
    estLow,
    estHigh,
    hasPricing,
    fmtUSD: formatUsdCompact,
  };
}