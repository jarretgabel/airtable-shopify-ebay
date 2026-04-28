import {
  addProductToCollections,
  getCollections,
  getProduct,
  getProducts,
  resolveTaxonomyCategory,
  searchCollections,
  searchTaxonomyCategories,
  updateProductCategory,
  uploadImageFile,
  upsertExistingProductWithCollectionsInSingleMutation,
  upsertProductWithUnifiedRequest,
} from '@/services/app-api/shopify';
import type { ShopifyUnifiedProductSetRequest } from '@/services/shopify';

vi.mock('@/services/shopify', () => ({
  shopifyService: {
    getCollections: vi.fn(),
    getProduct: vi.fn(),
    getProducts: vi.fn(),
    addProductToCollections: vi.fn(),
    resolveTaxonomyCategory: vi.fn(),
    searchCollections: vi.fn(),
    searchTaxonomyCategories: vi.fn(),
    updateProductCategory: vi.fn(),
    uploadImageFile: vi.fn(),
    upsertExistingProductWithCollectionsInSingleMutation: vi.fn(),
    upsertProductWithUnifiedRequest: vi.fn(),
  },
}));

describe('app-api shopify', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(async () => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_USE_LAMBDA_SHOPIFY', 'false');
    vi.stubEnv('VITE_APP_API_BASE_URL', '');
    fetchMock.mockReset();
    const mod = await import('@/services/shopify');
    vi.mocked(mod.shopifyService.addProductToCollections).mockReset();
    vi.mocked(mod.shopifyService.getCollections).mockReset();
    vi.mocked(mod.shopifyService.getProduct).mockReset();
    vi.mocked(mod.shopifyService.getProducts).mockReset();
    vi.mocked(mod.shopifyService.resolveTaxonomyCategory).mockReset();
    vi.mocked(mod.shopifyService.searchCollections).mockReset();
    vi.mocked(mod.shopifyService.searchTaxonomyCategories).mockReset();
    vi.mocked(mod.shopifyService.updateProductCategory).mockReset();
    vi.mocked(mod.shopifyService.uploadImageFile).mockReset();
    vi.mocked(mod.shopifyService.upsertExistingProductWithCollectionsInSingleMutation).mockReset();
    vi.mocked(mod.shopifyService.upsertProductWithUnifiedRequest).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('delegates to the direct Shopify service when Lambda mode is off', async () => {
    const mod = await import('@/services/shopify');
    vi.mocked(mod.shopifyService.getProducts).mockResolvedValue([{ id: 1, title: 'Amp', created_at: 'now', updated_at: 'now' } as never]);

    const result = await getProducts(250);

    expect(mod.shopifyService.getProducts).toHaveBeenCalledWith(250);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual([{ id: 1, title: 'Amp', created_at: 'now', updated_at: 'now' }]);
  });

  it('calls the Lambda Shopify endpoint when Lambda mode is on', async () => {
    vi.stubEnv('VITE_USE_LAMBDA_SHOPIFY', 'true');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: 2, title: 'DAC', created_at: 'later', updated_at: 'later' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await getProducts(250);

    expect(fetchMock).toHaveBeenCalledWith('/api/shopify/products?limit=250', {
      headers: { Accept: 'application/json' },
    });
    expect(result).toEqual([{ id: 2, title: 'DAC', created_at: 'later', updated_at: 'later' }]);
  });

  it('rethrows Lambda Shopify failures as plain Errors', async () => {
    vi.stubEnv('VITE_USE_LAMBDA_SHOPIFY', 'true');
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

  it('delegates collection search to the direct Shopify service when Lambda mode is off', async () => {
    const mod = await import('@/services/shopify');
    vi.mocked(mod.shopifyService.searchCollections).mockResolvedValue([{ id: 'gid://shopify/Collection/1', title: 'Pedals', handle: 'pedals' }]);

    const result = await searchCollections('pedals', 25);

    expect(mod.shopifyService.searchCollections).toHaveBeenCalledWith('pedals', 25);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual([{ id: 'gid://shopify/Collection/1', title: 'Pedals', handle: 'pedals' }]);
  });

  it('calls the Lambda taxonomy resolve endpoint when Lambda mode is on', async () => {
    vi.stubEnv('VITE_USE_LAMBDA_SHOPIFY', 'true');
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
      headers: { Accept: 'application/json' },
    });
    expect(result).toEqual({
      id: 'gid://shopify/TaxonomyCategory/sg-1',
      fullName: 'Guitars > Electric Guitars',
      name: 'Electric Guitars',
      isLeaf: true,
    });
  });

  it('calls the Lambda collection and product read endpoints when Lambda mode is on', async () => {
    vi.stubEnv('VITE_USE_LAMBDA_SHOPIFY', 'true');
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
      headers: { Accept: 'application/json' },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/shopify/taxonomy-categories/search?search=synth&first=20', {
      headers: { Accept: 'application/json' },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/shopify/products/44', {
      headers: { Accept: 'application/json' },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(4, '/api/shopify/collections/search?first=5', {
      headers: { Accept: 'application/json' },
    });
    expect(collections).toHaveLength(1);
    expect(taxonomyMatches).toHaveLength(1);
    expect(product?.id).toBe(44);
    expect(searchedCollections).toHaveLength(1);
  });

  it('delegates write mutations to the direct Shopify service when Lambda mode is off', async () => {
    const mod = await import('@/services/shopify');
    const request = { input: { title: 'Amp' }, synchronous: true } as never;
    vi.mocked(mod.shopifyService.upsertProductWithUnifiedRequest).mockResolvedValue({
      id: 9,
      adminGraphqlApiId: 'gid://shopify/Product/9',
      title: 'Amp',
      status: 'DRAFT',
    });
    vi.mocked(mod.shopifyService.upsertExistingProductWithCollectionsInSingleMutation).mockResolvedValue({
      product: { id: 9, adminGraphqlApiId: 'gid://shopify/Product/9', title: 'Amp', status: 'DRAFT' },
      collectionFailures: [],
    });
    vi.mocked(mod.shopifyService.addProductToCollections).mockResolvedValue();

    const upserted = await upsertProductWithUnifiedRequest(request);
    const combined = await upsertExistingProductWithCollectionsInSingleMutation(request, ['gid://shopify/Collection/1']);
    await addProductToCollections(9, ['gid://shopify/Collection/1']);

    expect(mod.shopifyService.upsertProductWithUnifiedRequest).toHaveBeenCalledWith(request);
    expect(mod.shopifyService.upsertExistingProductWithCollectionsInSingleMutation).toHaveBeenCalledWith(request, ['gid://shopify/Collection/1']);
    expect(mod.shopifyService.addProductToCollections).toHaveBeenCalledWith(9, ['gid://shopify/Collection/1']);
    expect(upserted.id).toBe(9);
    expect(combined.collectionFailures).toEqual([]);
  });

  it('calls the Lambda Shopify mutation endpoints when Lambda mode is on', async () => {
    vi.stubEnv('VITE_USE_LAMBDA_SHOPIFY', 'true');
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
      );

    const upserted = await upsertProductWithUnifiedRequest(request);
    const combined = await upsertExistingProductWithCollectionsInSingleMutation(request, ['gid://shopify/Collection/2']);
    await addProductToCollections(10, ['gid://shopify/Collection/2']);

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/shopify/product-set', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ request }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/shopify/product-set-with-collections', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ request, collectionIds: ['gid://shopify/Collection/2'] }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/shopify/products/10/collections', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ collectionIds: ['gid://shopify/Collection/2'] }),
    });
    expect(upserted.id).toBe(10);
    expect(combined.collectionFailures).toEqual(['gid://shopify/Collection/2: denied']);
  });

  it('delegates category update and image upload to the direct Shopify service when Lambda mode is off', async () => {
    const mod = await import('@/services/shopify');
    const file = new File(['abc'], 'photo.jpg', { type: 'image/jpeg' });
    vi.mocked(mod.shopifyService.updateProductCategory).mockResolvedValue();
    vi.mocked(mod.shopifyService.uploadImageFile).mockResolvedValue({
      id: 'gid://shopify/MediaImage/1',
      url: 'https://cdn.example.com/photo.jpg',
    });

    await updateProductCategory(11, 'gid://shopify/TaxonomyCategory/1');
    const uploaded = await uploadImageFile(file, 'Front panel');

    expect(mod.shopifyService.updateProductCategory).toHaveBeenCalledWith(11, 'gid://shopify/TaxonomyCategory/1');
    expect(mod.shopifyService.uploadImageFile).toHaveBeenCalledWith(file, 'Front panel');
    expect(uploaded.url).toBe('https://cdn.example.com/photo.jpg');
  });

  it('calls the Lambda Shopify category and image endpoints when Lambda mode is on', async () => {
    vi.stubEnv('VITE_USE_LAMBDA_SHOPIFY', 'true');
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