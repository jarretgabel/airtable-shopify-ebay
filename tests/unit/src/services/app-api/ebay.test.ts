import {
  createSampleListing,
  getEbayApprovalPreview,
  getEbayChildCategories,
  getEbayDashboardSnapshot,
  getEbayPackageTypes,
  getEbayRootCategories,
  getEbayRuntimeConfig,
  getInventoryItems,
  getOffer,
  getOffers,
  getOffersForInventorySkus,
  publishApprovalRecordToEbay,
  publishSampleDraftListing,
  pushApprovalBundleToEbay,
  searchEbayCategorySuggestions,
  uploadImageToEbayHostedPictures,
} from '@/services/app-api/ebay';

describe('app-api ebay', () => {
  const fetchMock = vi.fn<typeof fetch>();

  function expectApiPath(path: string) {
    return expect.stringContaining(path);
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls the Lambda eBay read endpoints', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ inventoryItems: [{ sku: 'ABC123' }], total: 1 }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ offers: [{ sku: 'ABC123', offerId: '123' }], total: 1 }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ offerId: '123', sku: 'ABC123', marketplaceId: 'EBAY_US', format: 'FIXED_PRICE', listingDuration: 'GTC', includeCatalogProductDetails: false }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ offers: [{ sku: 'ABC123', offerId: '123' }], total: 1 }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ authMode: 'server', environment: 'production', defaultListingApiMode: 'inventory', publishSetup: { locationConfig: { key: 'warehouse', name: 'Warehouse', country: 'US', postalCode: '10001', city: 'New York', stateOrProvince: 'NY' }, policyConfig: { fulfillmentPolicyId: 'fulfillment', paymentPolicyId: 'payment', returnPolicyId: 'return' } }, missingLocationFields: [], missingPolicyFields: [], hasRequiredPublishSetup: true }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ inventoryItems: [{ sku: 'ABC123' }], offers: [{ sku: 'ABC123', offerId: '123' }], recentListings: [], total: 1, warning: null, runtimeConfig: { authMode: 'server', environment: 'production', defaultListingApiMode: 'inventory', publishSetup: { locationConfig: { key: 'warehouse', name: 'Warehouse', country: 'US', postalCode: '10001', city: 'New York', stateOrProvince: 'NY' }, policyConfig: { fulfillmentPolicyId: 'fulfillment', paymentPolicyId: 'payment', returnPolicyId: 'return' } }, missingLocationFields: [], missingPolicyFields: [], hasRequiredPublishSetup: true } }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const inventory = await getInventoryItems(100);
    const offers = await getOffers('ABC123', 10);
    const offer = await getOffer('123');
    const offersBySku = await getOffersForInventorySkus(['ABC123']);
    const runtimeConfig = await getEbayRuntimeConfig();
    const dashboardSnapshot = await getEbayDashboardSnapshot();

    expect(fetchMock).toHaveBeenNthCalledWith(1, expectApiPath('/api/ebay/inventory-items?limit=100'), {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, expectApiPath('/api/ebay/offers?sku=ABC123&limit=10'), {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, expectApiPath('/api/ebay/offers/123'), {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(4, expectApiPath('/api/ebay/offers/by-skus'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ skus: ['ABC123'] }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(5, expectApiPath('/api/ebay/runtime-config'), {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(6, expectApiPath('/api/ebay/dashboard-snapshot'), {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    expect(inventory.total).toBe(1);
    expect(offers.total).toBe(1);
    expect(offer.offerId).toBe('123');
    expect(offersBySku.total).toBe(1);
    expect(runtimeConfig.hasRequiredPublishSetup).toBe(true);
    expect(dashboardSnapshot.total).toBe(1);
  });

  it('calls the Lambda eBay taxonomy and package endpoints', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: '1', name: 'Amplifiers', path: 'Amplifiers', level: 1 }]), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: '2', name: 'Audio', path: 'Audio', level: 0, hasChildren: true }]), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: '3', name: 'Tube Amps', path: 'Audio > Tube Amps', level: 1, hasChildren: false }]), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(['Letter', 'Package/Thick Envelope']), { status: 200, headers: { 'content-type': 'application/json' } }));

    const suggestions = await searchEbayCategorySuggestions('amp', 'EBAY_US');
    const roots = await getEbayRootCategories('EBAY_US');
    const children = await getEbayChildCategories('2', 'EBAY_US');
    const packageTypes = await getEbayPackageTypes('EBAY_US');

    expect(fetchMock).toHaveBeenNthCalledWith(1, expectApiPath('/api/ebay/taxonomy/suggestions?query=amp&marketplaceId=EBAY_US'), {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, expectApiPath('/api/ebay/taxonomy/root-categories?marketplaceId=EBAY_US'), {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, expectApiPath('/api/ebay/taxonomy/child-categories?parentCategoryId=2&marketplaceId=EBAY_US'), {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(4, expectApiPath('/api/ebay/package-types?marketplaceId=EBAY_US'), {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    expect(suggestions).toHaveLength(1);
    expect(roots).toHaveLength(1);
    expect(children).toHaveLength(1);
    expect(packageTypes).toEqual(['Letter', 'Package/Thick Envelope']);
  });

  it('calls the Lambda eBay write endpoints', async () => {
    const publishSetup = {
      locationConfig: {
        key: 'warehouse',
        name: 'Warehouse',
        country: 'US',
        postalCode: '10001',
        city: 'New York',
        stateOrProvince: 'NY',
      },
      policyConfig: {
        fulfillmentPolicyId: 'fulfillment',
        paymentPolicyId: 'payment',
        returnPolicyId: 'return',
      },
    };
    const bundle = {
      inventoryItem: { sku: 'ABC123' },
      offer: { sku: 'ABC123' },
    };
    const file = new File(['test'], 'probe.jpg', { type: 'image/jpeg' });
    const fileReaderReadAsDataURL = vi.fn(function(this: FileReader) {
      Object.defineProperty(this, 'result', {
        configurable: true,
        value: 'data:image/jpeg;base64,dGVzdA==',
      });
      this.onload?.({ target: this } as ProgressEvent<FileReader>);
    });
    vi.stubGlobal('FileReader', class {
      result: string | ArrayBuffer | null = null;
      error: DOMException | null = null;
      onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
      onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;
      readAsDataURL = fileReaderReadAsDataURL;
    } as unknown as typeof FileReader);

    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ mode: 'inventory', sku: 'ABC123', offerId: 'offer-1', status: 'UNPUBLISHED' }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ sku: 'ABC123', offerId: 'offer-1', listingId: 'listing-1' }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ sku: 'ABC123', offerId: 'offer-1', listingId: 'listing-1', wasExistingOffer: false }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ sku: 'ABC123', offerId: 'offer-1', listingId: 'listing-1', wasExistingOffer: false }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: 'https://example.com/image.jpg' }), { status: 200, headers: { 'content-type': 'application/json' } }));

    await createSampleListing('inventory', publishSetup);
    await publishSampleDraftListing(publishSetup);
    await pushApprovalBundleToEbay(bundle as never, publishSetup);
    await publishApprovalRecordToEbay('approval-ebay', 'rec123', publishSetup);
    await uploadImageToEbayHostedPictures(file);

    expect(fetchMock).toHaveBeenNthCalledWith(1, expectApiPath('/api/ebay/sample-listings'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mode: 'inventory', publishSetup }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, expectApiPath('/api/ebay/sample-listings/publish'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ publishSetup }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, expectApiPath('/api/ebay/approval-listings/publish'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bundle, publishSetup }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(4, expectApiPath('/api/ebay/approval-listings/publish'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ source: 'approval-ebay', recordId: 'rec123', publishSetup }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(5, expectApiPath('/api/ebay/images'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: 'probe.jpg',
        mimeType: 'image/jpeg',
        file: 'dGVzdA==',
      }),
    });
  });

  it('calls the Lambda eBay approval preview endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        generatedBodyHtml: '<p>Preview</p>',
        draftPayloadBundle: {
          inventoryItem: { sku: 'ABC123' },
          offer: { sku: 'ABC123' },
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    const preview = await getEbayApprovalPreview(
      { Title: 'Amp' },
      {
        templateHtml: '<html>{{title}}</html>',
        title: 'Amp',
        description: 'Great amp',
        keyFeatures: 'Power: 100W',
      },
    );

    expect(fetchMock).toHaveBeenCalledWith(expectApiPath('/api/ebay/approval-listings/preview'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: { Title: 'Amp' },
        bodyPreview: {
          templateHtml: '<html>{{title}}</html>',
          title: 'Amp',
          description: 'Great amp',
          keyFeatures: 'Power: 100W',
        },
      }),
    });
    expect(preview.generatedBodyHtml).toBe('<p>Preview</p>');
  });

  it('rethrows Lambda eBay failures as plain Errors', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        message: 'eBay token refresh failed',
        service: 'ebay',
        code: 'EBAY_TOKEN_REFRESH_FAILED',
        retryable: false,
      }), { status: 401, headers: { 'content-type': 'application/json' } }),
    );

    await expect(getInventoryItems(25)).rejects.toMatchObject({
      message: 'eBay token refresh failed',
    });
  });
});