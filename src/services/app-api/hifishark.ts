import type { HiFiSharkListing } from '@/types/hifishark';
import { toServiceErrorMessage } from './errors';
import { getJson } from './http';

function toHiFiSharkError(error: unknown, slug: string): Error {
  return toServiceErrorMessage(
    'hifishark',
    'HIFISHARK_GET_MODEL_FAILED',
    `Failed to load HiFiShark listings for ${slug}.`,
    error,
    true,
  );
}

export async function getListingsForModel(slug: string): Promise<HiFiSharkListing[]> {
  try {
    return await getJson<HiFiSharkListing[]>(`/api/hifishark/model/${encodeURIComponent(slug)}`);
  } catch (error) {
    throw toHiFiSharkError(error, slug);
  }
}