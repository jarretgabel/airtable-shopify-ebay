import type { HiFiSharkListing } from '@/types/hifishark';
import { getListingsForModel } from '@/services/app-api/hifishark';

export async function scrapeHiFiShark(slug: string): Promise<HiFiSharkListing[]> {
  return getListingsForModel(slug);
}
