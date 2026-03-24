export function trimShopifyProductType(value: string): string {
  const normalized = value.trim();
  if (!normalized) return '';

  const segments = normalized
    .split('>')
    .map((segment) => segment.trim())
    .filter(Boolean);

  return segments.length > 0 ? segments[segments.length - 1] : normalized;
}
