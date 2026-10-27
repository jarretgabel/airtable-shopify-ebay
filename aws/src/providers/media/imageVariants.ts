import type { MediaStore } from './mediaStore.js';

/** Smaller copies of the processed image (which is at most 1200 px) for lists and previews. */
export const IMAGE_VARIANT_WIDTHS = [400, 800] as const;
export type ImageVariantWidth = (typeof IMAGE_VARIANT_WIDTHS)[number];

export function parseVariantWidth(value: string | undefined): ImageVariantWidth | null {
  const width = Number(value);
  return IMAGE_VARIANT_WIDTHS.find((allowed) => allowed === width) ?? null;
}

/** Same name under a per-width prefix, so a variant always sits next to nothing else and never collides with an image. */
export function variantKey(key: string, width: ImageVariantWidth): string {
  return `variants/w${width}/${key}`;
}

/** The variant key when that variant exists, otherwise the original key. */
export async function resolveVariantKey(media: MediaStore, key: string, width: ImageVariantWidth | null): Promise<string> {
  if (!width) return key;
  const candidate = variantKey(key, width);
  return (await media.header(candidate, 1)) ? candidate : key;
}
