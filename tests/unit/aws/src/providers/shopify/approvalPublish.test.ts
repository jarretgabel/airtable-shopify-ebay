import test from 'node:test';
import assert from 'node:assert/strict';
import { upsertWithCollectionFallback } from '../../../../../../aws/src/providers/shopify/approvalPublish.js';

const productResult = {
  id: 123,
  adminGraphqlApiId: 'gid://shopify/Product/123',
  title: 'Test amplifier',
};

test('Shopify publish uses source image URLs without staged reuploads by default', async () => {
  let reuploadCalls = 0;
  let directImageUrl = '';

  const result = await upsertWithCollectionFallback({
    product: {
      title: 'Test amplifier',
      images: [{ src: 'https://images.example.com/amplifier.jpg' }],
    },
    collectionIds: [],
  }, {
    addProductToCollections: async () => {},
    reuploadProductImagesForShopify: async (product) => {
      reuploadCalls += 1;
      return { product, warnings: [] };
    },
    upsertExistingProductWithCollectionsInSingleMutation: async () => ({
      product: productResult,
      collectionFailures: [],
    }),
    upsertProductWithUnifiedRequest: async (request) => {
      directImageUrl = request.input.files?.[0]?.originalSource ?? '';
      return productResult;
    },
  });

  assert.equal(result.product.id, 123);
  assert.equal(directImageUrl, 'https://images.example.com/amplifier.jpg');
  assert.equal(reuploadCalls, 0);
});

test('Shopify publish stages images only after a media format mismatch', async () => {
  let upsertCalls = 0;
  let reuploadCalls = 0;

  const result = await upsertWithCollectionFallback({
    product: {
      title: 'Test amplifier',
      images: [{ src: 'https://images.example.com/amplifier' }],
    },
    collectionIds: [],
  }, {
    addProductToCollections: async () => {},
    reuploadProductImagesForShopify: async (product) => {
      reuploadCalls += 1;
      return {
        product: {
          ...product,
          images: [{ src: 'https://cdn.shopify.com/amplifier.jpg' }],
        },
        warnings: [],
      };
    },
    upsertExistingProductWithCollectionsInSingleMutation: async () => ({
      product: productResult,
      collectionFailures: [],
    }),
    upsertProductWithUnifiedRequest: async (request) => {
      upsertCalls += 1;
      if (upsertCalls === 1) {
        throw new Error("Media upload failed: file extension doesn't match the format of the file");
      }
      assert.equal(request.input.files?.[0]?.originalSource, 'https://cdn.shopify.com/amplifier.jpg');
      return productResult;
    },
  });

  assert.equal(result.product.id, 123);
  assert.equal(upsertCalls, 2);
  assert.equal(reuploadCalls, 1);
  assert.match(result.warnings.join(' '), /retried publish with normalized uploaded media files/i);
});