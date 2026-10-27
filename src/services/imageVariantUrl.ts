/** Widths the server keeps smaller copies for; keep in sync with aws/src/providers/media/imageVariants.ts. */
export const IMAGE_VARIANT_WIDTHS = [400, 800];

/** Hosted workflow images can be requested at a smaller size; the server falls back to the full image if none exists. */
export function getImageVariantUrl(url: string, width: 400 | 800): string {
  if (!/\/api\/media\/used-gear-workflow\//.test(url) || url.includes('?')) return url;
  return `${url}?w=${width}`;
}
