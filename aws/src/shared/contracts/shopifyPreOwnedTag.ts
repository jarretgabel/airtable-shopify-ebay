// Feeds the "Pre-Owned Hifi" smart collection (rule: tag equals this value).
export const PRE_OWNED_HIFI_TAG = 'Pre-Owned Hifi';

// Adds the tag only for items whose normalized condition is "Used". A blank or any other condition leaves the tags
// untouched, and an existing copy of the tag (any case) is never duplicated. Operates on the comma-separated tag string.
export function withPreOwnedHifiTag(tagsCsv: string | undefined, condition: string | undefined): string | undefined {
  if (condition !== 'Used') {
    return tagsCsv;
  }

  const existing = (tagsCsv ?? '').split(',').map((tag) => tag.trim()).filter(Boolean);
  if (existing.some((tag) => tag.toLowerCase() === PRE_OWNED_HIFI_TAG.toLowerCase())) {
    return tagsCsv;
  }

  return [...existing, PRE_OWNED_HIFI_TAG].join(', ');
}
