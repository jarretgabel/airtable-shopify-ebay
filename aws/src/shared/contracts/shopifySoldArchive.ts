export const SHOPIFY_SOLD_ARCHIVE_TAG = 'sold-archive';

export function hasSoldArchiveTag(tags: readonly string[] | null | undefined): boolean {
  return (tags ?? []).some((tag) => tag.trim().toLowerCase() === SHOPIFY_SOLD_ARCHIVE_TAG);
}
