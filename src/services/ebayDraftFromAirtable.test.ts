import { buildEbayDraftPayloadBundleFromApprovalFields } from '@/services/ebayDraftFromAirtable';

describe('buildEbayDraftPayloadBundleFromApprovalFields', () => {
  it('builds inventory item and offer payload from eBay approval fields', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-1',
      'eBay Inventory Product Title': 'eBay Product Title',
      'eBay Inventory Product Description': '<p>eBay description</p>',
      'eBay Inventory Product Brand': 'McIntosh',
      'eBay Inventory Product MPN': 'MA8900',
      'eBay Inventory Condition': 'USED_EXCELLENT',
      'eBay Inventory Ship To Location Quantity': '2',
      ebay_inventory_product_imageurls_json: JSON.stringify([
        { src: 'https://cdn.example.com/1.jpg', alt: 'ignored for eBay API' },
        { src: 'https://cdn.example.com/2.jpg' },
      ]),
      'eBay Offer Marketplace ID': 'EBAY_US',
      'eBay Offer Format': 'FIXED_PRICE',
      'eBay Offer Category ID': '3276',
      'eBay Offer Listing Duration': 'GTC',
      'eBay Offer Price Value': '4999.00',
      'eBay Offer Price Currency': 'USD',
      'eBay Offer Quantity Limit Per Buyer': '1',
    });

    expect(payload.inventoryItem).toEqual({
      sku: 'EBAY-SKU-1',
      product: {
        title: 'eBay Product Title',
        description: '<p>eBay description</p>',
        imageUrls: ['https://cdn.example.com/1.jpg', 'https://cdn.example.com/2.jpg'],
        brand: 'McIntosh',
        mpn: 'MA8900',
        aspects: { Brand: ['McIntosh'] },
      },
      condition: 'USED_EXCELLENT',
      conditionDescription: undefined,
      availability: {
        shipToLocationAvailability: {
          quantity: 2,
        },
      },
    });

    expect(payload.offer).toEqual({
      sku: 'EBAY-SKU-1',
      marketplaceId: 'EBAY_US',
      format: 'FIXED_PRICE',
      availableQuantity: 2,
      categoryId: '3276',
      listingDescription: '<p>eBay description</p>',
      listingDuration: 'GTC',
      pricingSummary: {
        price: {
          value: '4999.00',
          currency: 'USD',
        },
      },
      quantityLimitPerBuyer: 1,
      includeCatalogProductDetails: false,
    });
  });

  it('parses comma-separated image urls when JSON is not provided', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-2',
      'Image URLs': 'https://cdn.example.com/a.jpg, https://cdn.example.com/b.jpg',
    });

    expect(payload.inventoryItem).toMatchObject({
      sku: 'EBAY-SKU-2',
      product: {
        imageUrls: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
      },
    });
  });

  it('maps shared Images column into eBay inventory imageUrls', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-IMAGES',
      Images: 'https://cdn.example.com/c.jpg, https://cdn.example.com/d.jpg',
      'Images Alt Text': 'Front view, Back view',
    });

    expect(payload.inventoryItem).toMatchObject({
      sku: 'EBAY-SKU-IMAGES',
      product: {
        imageUrls: ['https://cdn.example.com/c.jpg', 'https://cdn.example.com/d.jpg'],
      },
    });
  });

  it('maps human condition labels to eBay condition enums', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-3',
      __Condition__: 'For Parts or not working',
    });

    expect(payload.inventoryItem).toMatchObject({
      sku: 'EBAY-SKU-3',
      condition: 'FOR_PARTS_OR_NOT_WORKING',
    });
  });

  it('uses Categories field for eBay offer category id', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-4',
      Categories: '14990',
      'eBay Offer Category ID': '3276',
    });

    expect(payload.offer).toMatchObject({
      sku: 'EBAY-SKU-4',
      categoryId: '14990',
    });
  });

  it('maps primary and secondary categories from Categories field', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-5',
      Categories: '14990, 15032',
      'eBay Offer Category ID': '3276',
      'eBay Offer Secondary Category ID': '9999',
    });

    expect(payload.offer).toMatchObject({
      sku: 'EBAY-SKU-5',
      categoryId: '14990',
      secondaryCategoryId: '15032',
    });
  });

  it('falls back to explicit secondary category when Categories has one value', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-6',
      Categories: '14990',
      'eBay Offer Secondary Category ID': '15032',
    });

    expect(payload.offer).toMatchObject({
      sku: 'EBAY-SKU-6',
      categoryId: '14990',
      secondaryCategoryId: '15032',
    });
  });
});
