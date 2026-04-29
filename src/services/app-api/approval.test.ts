import { normalizeApprovalRecord, publishApprovalRecord } from '@/services/app-api/approval';

describe('app-api approval', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_APP_API_BASE_URL', '');
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('calls the backend approval publish orchestration endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        target: 'both',
        shopify: { productId: '99', mode: 'updated', warnings: [], wroteProductId: false, staleProductIdCleared: false },
        ebay: { sku: 'ABC123', offerId: 'offer-1', listingId: 'listing-1', wasExistingOffer: false, mode: 'created' },
        failures: [],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await publishApprovalRecord('approval-combined', 'rec123', 'both', {
      productIdFieldName: 'Shopify REST Product ID',
      fields: { Title: 'Edited title' },
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/approval/publish', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target: 'both',
        source: 'approval-combined',
        recordId: 'rec123',
        productIdFieldName: 'Shopify REST Product ID',
        fields: { Title: 'Edited title' },
      }),
    });
    expect(result.shopify?.productId).toBe('99');
    expect(result.ebay?.listingId).toBe('listing-1');
  });

  it('calls the backend approval normalize endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        target: 'both',
        shopify: {
          draftProduct: { title: 'Amp' },
          effectiveProduct: { title: 'Amp' },
          tagValues: ['vintage', 'amp'],
          collectionIds: [],
          collectionLabelsById: { 'gid://shopify/Collection/2': 'Amplifiers' },
          bodyHtmlResolution: { sourceFieldName: 'Body HTML', sourceType: 'exact', value: '<p>Amp</p>' },
          productDescriptionResolution: { sourceFieldName: 'Description', sourceType: 'exact', value: 'Amp' },
          productCategoryResolution: { sourceFieldName: 'Category', sourceType: 'exact', value: 'Amplifiers' },
          categoryIdResolution: { sourceFieldName: '', sourceType: 'none', value: '' },
          categoryLookupValue: 'Amplifiers',
          categoryResolution: { status: 'resolved', match: null, error: '' },
          productSetRequest: { input: { title: 'Amp' }, synchronous: true },
        },
        ebay: {
          generatedBodyHtml: '<p>Preview</p>',
          draftPayloadBundle: {
            inventoryItem: { sku: 'ABC123' },
            offer: { sku: 'ABC123' },
          },
          categoryFieldUpdates: { 'Primary Category Name': 'Amplifiers & Preamps' },
        },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await normalizeApprovalRecord({ Title: 'Amp' }, 'both', {
      bodyPreview: {
        templateHtml: '<html>{{title}}</html>',
        title: 'Amp',
        description: 'Great amp',
        keyFeatures: 'Power:100W',
      },
      categoryPreview: {
        labelsById: {
          '3276': 'Amplifiers & Preamps',
        },
      },
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/approval/normalize', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target: 'both',
        fields: { Title: 'Amp' },
        bodyPreview: {
          templateHtml: '<html>{{title}}</html>',
          title: 'Amp',
          description: 'Great amp',
          keyFeatures: 'Power:100W',
        },
        categoryPreview: {
          labelsById: {
            '3276': 'Amplifiers & Preamps',
          },
        },
      }),
    });
    expect(result.shopify?.effectiveProduct.title).toBe('Amp');
    expect(result.shopify?.tagValues).toEqual(['vintage', 'amp']);
    expect(result.shopify?.collectionLabelsById).toEqual({ 'gid://shopify/Collection/2': 'Amplifiers' });
    expect(result.ebay?.categoryFieldUpdates).toEqual({ 'Primary Category Name': 'Amplifiers & Preamps' });
    expect(result.ebay?.generatedBodyHtml).toBe('<p>Preview</p>');
  });
});