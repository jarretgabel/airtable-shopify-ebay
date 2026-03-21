import type { EbayLocationConfig } from './types';
import { API, getMissingLocationFields } from './config';
import { inventoryJsonHeaders } from './listingPayloads';

export async function upsertWarehouseLocation(token: string, config: EbayLocationConfig): Promise<void> {
  const missing = getMissingLocationFields(config);
  if (missing.length > 0) {
    throw new Error(`Missing eBay inventory location setup: ${missing.join(', ')}.`);
  }

  const body = {
    name: config.name || config.key,
    merchantLocationStatus: 'ENABLED',
    locationTypes: ['WAREHOUSE'],
    location: {
      address: {
        country: config.country,
        ...(config.postalCode ? { postalCode: config.postalCode } : {}),
        ...(config.city ? { city: config.city } : {}),
        ...(config.stateOrProvince ? { stateOrProvince: config.stateOrProvince } : {}),
      },
    },
  };

  const res = await fetch(`${API}/sell/inventory/v1/location/${encodeURIComponent(config.key)}`, {
    method: 'POST',
    headers: inventoryJsonHeaders(token),
    body: JSON.stringify(body),
  });

  if (res.ok || res.status === 204 || res.status === 409) return;

  const err = await res.json().catch(() => ({}));
  throw new Error(`createInventoryLocation ${res.status}: ${JSON.stringify(err)}`);
}