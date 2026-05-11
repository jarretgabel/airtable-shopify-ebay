import {
  addProductToCollections,
  getShopifyApprovalPreview,
  getCollections,
  getProduct,
  getProducts,
  publishApprovalListingToShopify,
  resolveTaxonomyCategory,
  searchCollections,
  searchTaxonomyCategories,
  updateProductCategory,
  uploadImageFile,
  upsertExistingProductWithCollectionsInSingleMutation,
  upsertProductWithUnifiedRequest,
} from '@/services/app-api/shopify';
import type { ShopifyUnifiedProductSetRequest } from '@/services/shopify';

describe('app-api shopify', () => {
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

  it('calls the Lambda Shopify products endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: 2, title: 'DAC', created_at: 'later', updated_at: 'later' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await getProducts(250);

    expect(fetchMock).toHaveBeenCalledWith('/api/shopify/products?limit=250', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    expect(result).toEqual([{ id: 2, title: 'DAC', created_at: 'later', updated_at: 'later' }]);
  });

  it('rethrows Lambda Shopify failures as plain Errors', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        message: 'Shopify API error: HTTP 401 on /products.json',
        service: 'shopify',
        code: 'SHOPIFY_HTTP_ERROR',
        retryable: false,
      }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(getProducts(250)).rejects.toMatchObject({
      message: 'Shopify API error: HTTP 401 on /products.json',
    });
  });

  it('calls the Lambda taxonomy resolve endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        id: 'gid://shopify/TaxonomyCategory/sg-1',
        fullName: 'Guitars > Electric Guitars',
        name: 'Electric Guitars',
        isLeaf: true,
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await resolveTaxonomyCategory('Electric Guitars');

    expect(fetchMock).toHaveBeenCalledWith('/api/shopify/taxonomy-categories/resolve?searchOrId=Electric+Guitars', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    expect(result).toEqual({
      id: 'gid://shopify/TaxonomyCategory/sg-1',
      fullName: 'Guitars > Electric Guitars',
      name: 'Electric Guitars',
      isLeaf: true,
    });
  });

  it('calls the Lambda collection and product read endpoints', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 'gid://shopify/Collection/2', title: 'Synths', handle: 'synths' }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 'gid://shopify/TaxonomyCategory/sg-2', fullName: 'Keys > Synthesizers', name: 'Synthesizers', isLeaf: true }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 44, adminGraphqlApiId: 'gid://shopify/Product/44', title: 'Juno-60', status: 'DRAFT' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 'gid://shopify/Collection/3', title: 'Drums', handle: 'drums' }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

    const collections = await getCollections(100);
    const taxonomyMatches = await searchTaxonomyCategories('synth', 20);
    const product = await getProduct(44);
    const searchedCollections = await searchCollections('', 5);

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/shopify/collections?first=100', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/shopify/taxonomy-categories/search?search=synth&first=20', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/shopify/products/44', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(4, '/api/shopify/collections/search?first=5', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    expect(collections).toHaveLength(1);
    expect(taxonomyMatches).toHaveLength(1);
    expect(product?.id).toBe(44);
    expect(searchedCollections).toHaveLength(1);
  });

  it('calls the Lambda Shopify mutation endpoints', async () => {
    const request: ShopifyUnifiedProductSetRequest = { input: { title: 'Amp' }, synchronous: true };
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 10, adminGraphqlApiId: 'gid://shopify/Product/10', title: 'Amp', status: 'DRAFT' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          product: { id: 10, adminGraphqlApiId: 'gid://shopify/Product/10', title: 'Amp', status: 'DRAFT' },
          collectionFailures: ['gid://shopify/Collection/2: denied'],
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ assigned: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ productId: '10', mode: 'updated', warnings: [], wroteProductId: false, staleProductIdCleared: false }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

    const upserted = await upsertProductWithUnifiedRequest(request);
    const combined = await upsertExistingProductWithCollectionsInSingleMutation(request, ['gid://shopify/Collection/2']);
    await addProductToCollections(10, ['gid://shopify/Collection/2']);
    const published = await publishApprovalListingToShopify('approval-shopify', 'rec123');

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/shopify/product-set', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ request }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/shopify/product-set-with-collections', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ request, collectionIds: ['gid://shopify/Collection/2'] }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/shopify/products/10/collections', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ collectionIds: ['gid://shopify/Collection/2'] }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(4, '/api/shopify/approval-listings/publish', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'approval-shopify',
        recordId: 'rec123',
        productIdFieldName: 'Shopify REST Product ID',
      }),
    });
    expect(upserted.id).toBe(10);
    expect(combined.collectionFailures).toEqual(['gid://shopify/Collection/2: denied']);
    expect(published.productId).toBe('10');
  });

  it('calls the Lambda Shopify approval preview endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        draftProduct: { title: 'Amp' },
        effectiveProduct: { title: 'Amp' },
        tagValues: ['vintage', 'amp'],
        collectionIds: ['gid://shopify/Collection/2'],
        bodyHtmlResolution: { sourceFieldName: 'Body HTML', sourceType: 'exact', value: '<p>Amp</p>' },
        productDescriptionResolution: { sourceFieldName: 'Description', sourceType: 'exact', value: 'Amp' },
        productCategoryResolution: { sourceFieldName: 'Category', sourceType: 'exact', value: 'Amplifiers' },
        categoryIdResolution: { sourceFieldName: 'Shopify Category ID', sourceType: 'exact', value: 'gid://shopify/TaxonomyCategory/1' },
        categoryLookupValue: 'gid://shopify/TaxonomyCategory/1',
        categoryResolution: { status: 'resolved', match: null, error: '' },
        resolvedCategoryId: 'gid://shopify/TaxonomyCategory/1',
        productSetRequest: { input: { title: 'Amp' }, synchronous: true },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const preview = await getShopifyApprovalPreview({ Title: 'Amp' });

    expect(fetchMock).toHaveBeenCalledWith('/api/shopify/approval-listings/preview', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: { Title: 'Amp' } }),
    });
    expect(preview.effectiveProduct.title).toBe('Amp');
    expect(preview.tagValues).toEqual(['vintage', 'amp']);
  });

  it('calls the Lambda Shopify category and image endpoints', async () => {
    const file = new File(['abc'], 'photo.jpg', { type: 'image/jpeg' });
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ updated: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'gid://shopify/MediaImage/1', url: 'https://cdn.example.com/photo.jpg' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

    await updateProductCategory(11, 'gid://shopify/TaxonomyCategory/1');
    const uploaded = await uploadImageFile(file, 'Front panel');

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/shopify/products/11/category', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ categoryId: 'gid://shopify/TaxonomyCategory/1' }),
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondCall = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(secondCall[0]).toBe('/api/shopify/images');
    expect(secondCall[1].method).toBe('POST');
    expect(secondCall[1].credentials).toBe('include');
    expect(secondCall[1].headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(secondCall[1].body as string)).toMatchObject({
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      alt: 'Front panel',
    });
    expect(uploaded.id).toBe('gid://shopify/MediaImage/1');
  });
});