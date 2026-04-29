import { describe, expect, it, vi, afterEach } from 'vitest';
import { getListingsForModel } from '@/services/app-api/hifishark';

describe('app-api hifishark', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('calls the Lambda HiFiShark endpoint', async () => {
    vi.stubEnv('VITE_APP_API_BASE_URL', '');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ([{ id: 'accuphase-e-530-0', title: 'Accuphase E-530', site: 'eBay', country: 'USA', price: '$100', priceNumeric: 100, currency: 'USD', listedDate: 'Jan 1, 2026', url: 'https://example.test/listing' }]),
    } as Response);

    const listings = await getListingsForModel('accuphase-e-530');

    expect(fetchMock).toHaveBeenCalledWith('/api/hifishark/model/accuphase-e-530', {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });
    expect(listings).toHaveLength(1);
  });
});