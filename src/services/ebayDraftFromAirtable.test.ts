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

  it('prefers Airtable Body HTML over Description for eBay payload descriptions', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-BODY-HTML',
      Description: 'Plain text fallback description',
      'Body HTML': '<p>Rich HTML description</p>',
    });

    expect(payload.inventoryItem).toMatchObject({
      sku: 'EBAY-SKU-BODY-HTML',
      product: {
        description: '<p>Rich HTML description</p>',
      },
    });

    expect(payload.offer).toMatchObject({
      sku: 'EBAY-SKU-BODY-HTML',
      listingDescription: '<p>Rich HTML description</p>',
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

  it('collects image URLs from indexed image fields when JSON list is absent', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-7',
      'eBay Inventory Product Image URL 1': 'https://cdn.example.com/e1.jpg',
      'eBay Inventory Product Image URL 2': 'https://cdn.example.com/e2.jpg',
      'Photo URLs (comma-separated)': 'https://cdn.example.com/e2.jpg, https://cdn.example.com/e3.jpg',
    });

    expect(payload.inventoryItem).toMatchObject({
      sku: 'EBAY-SKU-7',
      product: {
        imageUrls: [
          'https://cdn.example.com/e1.jpg',
          'https://cdn.example.com/e2.jpg',
          'https://cdn.example.com/e3.jpg',
        ],
      },
    });
  });

  it('maps primary and secondary category id aliases into offer payload', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-8',
      'Primary Category ID': '293',
      'Secondary Category ID': '11700',
    });

    expect(payload.offer).toMatchObject({
      sku: 'EBAY-SKU-8',
      categoryId: '293',
      secondaryCategoryId: '11700',
    });
  });

  it('parses Airtable attachment objects into imageUrls', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-9',
      'eBay Inventory Product Image URLs JSON': [
        {
          id: 'att1',
          url: 'https://dl.airtable.com/.attachments/att1/main.jpg',
          filename: 'main.jpg',
        },
        {
          id: 'att2',
          thumbnails: {
            large: {
              url: 'https://dl.airtable.com/.attachments/att2/large.jpg',
            },
          },
        },
      ],
    });

    expect(payload.inventoryItem).toMatchObject({
      sku: 'EBAY-SKU-9',
      product: {
        imageUrls: [
          'https://dl.airtable.com/.attachments/att1/main.jpg',
          'https://dl.airtable.com/.attachments/att2/large.jpg',
        ],
      },
    });
  });

  it('parses single JSON object image payload into imageUrls', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-10',
      'eBay Inventory Product Image URLs JSON': JSON.stringify({
        id: 'att-single',
        url: 'https://dl.airtable.com/.attachments/att-single/main.jpg',
      }),
    });

    expect(payload.inventoryItem).toMatchObject({
      sku: 'EBAY-SKU-10',
      product: {
        imageUrls: ['https://dl.airtable.com/.attachments/att-single/main.jpg'],
      },
    });
  });

  it('falls through to Images when leading eBay image field is present but empty', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-11',
      'eBay Inventory Product Image URLs JSON': '',
      Images: 'https://cdn.example.com/fallback-a.jpg, https://cdn.example.com/fallback-b.jpg',
    });

    expect(payload.inventoryItem).toMatchObject({
      sku: 'EBAY-SKU-11',
      product: {
        imageUrls: [
          'https://cdn.example.com/fallback-a.jpg',
          'https://cdn.example.com/fallback-b.jpg',
        ],
      },
    });
  });

  it('falls through to Images when leading eBay image field is an empty object', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-12',
      'eBay Inventory Product Image URLs JSON': {},
      Images: 'https://cdn.example.com/obj-fallback-a.jpg, https://cdn.example.com/obj-fallback-b.jpg',
    });

    expect(payload.inventoryItem).toMatchObject({
      sku: 'EBAY-SKU-12',
      product: {
        imageUrls: [
          'https://cdn.example.com/obj-fallback-a.jpg',
          'https://cdn.example.com/obj-fallback-b.jpg',
        ],
      },
    });
  });

  it('maps Images (comma-separated) into eBay imageUrls', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-14',
      'Images (comma-separated)': 'https://cdn.example.com/cs-a.jpg, https://cdn.example.com/cs-b.jpg',
    });

    expect(payload.inventoryItem).toMatchObject({
      sku: 'EBAY-SKU-14',
      product: {
        imageUrls: [
          'https://cdn.example.com/cs-a.jpg',
          'https://cdn.example.com/cs-b.jpg',
        ],
      },
    });
  });

  it('parses image URLs from attachments wrapper object payload', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-13',
      'eBay Inventory Product Image URLs JSON': {
        attachments: [
          { url: 'https://dl.airtable.com/.attachments/att-wrap-1/main.jpg' },
          { src: 'https://dl.airtable.com/.attachments/att-wrap-2/main.jpg' },
        ],
      },
    });

    expect(payload.inventoryItem).toMatchObject({
      sku: 'EBAY-SKU-13',
      product: {
        imageUrls: [
          'https://dl.airtable.com/.attachments/att-wrap-1/main.jpg',
          'https://dl.airtable.com/.attachments/att-wrap-2/main.jpg',
        ],
      },
    });
  });
});
