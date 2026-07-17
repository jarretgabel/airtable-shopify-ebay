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
      'Workflow Image Metadata JSON': JSON.stringify([
        {
          attachmentId: 'att-1',
          url: 'https://cdn.example.com/1.jpg',
          filename: '1.jpg',
          sourceStage: 'photos',
          includedInListing: true,
        },
        {
          attachmentId: 'att-2',
          url: 'https://cdn.example.com/2.jpg',
          filename: '2.jpg',
          sourceStage: 'photos',
          includedInListing: true,
        },
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
        description: 'eBay description',
        imageUrls: ['https://cdn.example.com/1.jpg', 'https://cdn.example.com/2.jpg'],
        brand: 'McIntosh',
        mpn: 'MA8900',
        aspects: { Brand: ['McIntosh'], Model: ['MA8900'], MPN: ['MA8900'] },
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

  it('maps key features into eBay product aspects', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-FEATURES',
      'eBay Inventory Product Brand': 'McIntosh',
      'Key Features (Key, Value)': 'Condition,Excellent\nIncludes,Remote and manual\nFinish,Black',
    });

    expect(payload.inventoryItem).toMatchObject({
      sku: 'EBAY-SKU-FEATURES',
      product: {
        aspects: {
          Brand: ['McIntosh'],
          Condition: ['Excellent'],
          Includes: ['Remote and manual'],
          Finish: ['Black'],
        },
      },
    });
  });

  it('converts plain description text into HTML for eBay listing description fields', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-DESC-HTML',
      Description: 'Line one\nLine two',
    });

    expect(payload.inventoryItem).toMatchObject({
      sku: 'EBAY-SKU-DESC-HTML',
      product: {
        description: 'Line one\nLine two',
      },
    });

    expect(payload.offer).toMatchObject({
      sku: 'EBAY-SKU-DESC-HTML',
      listingDescription: '<p>Line one<br />Line two</p>',
    });
  });

  it('keeps full eBay body HTML for listingDescription and keeps inventory description plain text', () => {
    const fullHtml = '<!DOCTYPE html><html><head><style>p{color:red;}</style></head><body><div><p>Line One</p><p>Line Two</p></div></body></html>';
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-FULL-DOC',
      'Ebay Body (HTML)': fullHtml,
    });

    expect(payload.inventoryItem).toMatchObject({
      sku: 'EBAY-SKU-FULL-DOC',
      product: {
        description: 'Line One\nLine Two',
      },
    });

    expect(payload.offer).toMatchObject({
      sku: 'EBAY-SKU-FULL-DOC',
      listingDescription: fullHtml,
    });
  });

  it('prefers plain Description for inventory description while keeping full eBay body HTML for listingDescription', () => {
    const fullHtml = '<!DOCTYPE html><html><head><style>.x{color:#111;}</style></head><body><div class="x"><p>Styled HTML Body</p></div></body></html>';
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-SPLIT-DESC',
      'Ebay Body (HTML)': fullHtml,
      Description: 'Plain summary from Description field',
    });

    expect(payload.inventoryItem).toMatchObject({
      sku: 'EBAY-SKU-SPLIT-DESC',
      product: {
        description: 'Plain summary from Description field',
      },
    });

    expect(payload.offer).toMatchObject({
      sku: 'EBAY-SKU-SPLIT-DESC',
      listingDescription: fullHtml,
    });
  });

  it('maps Model alias into eBay product aspects', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-MODEL',
      Brand: 'Marantz',
      Model: '2270',
    });

    expect(payload.inventoryItem).toMatchObject({
      sku: 'EBAY-SKU-MODEL',
      product: {
        mpn: '2270',
        aspects: {
          Brand: ['Marantz'],
          Model: ['2270'],
          MPN: ['2270'],
        },
      },
    });
  });

  it('maps Make into eBay Brand when Brand field is missing', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-MAKE-BRAND',
      Make: 'McIntosh',
      Model: 'MC275',
    });

    expect(payload.inventoryItem).toMatchObject({
      sku: 'EBAY-SKU-MAKE-BRAND',
      product: {
        brand: 'McIntosh',
        mpn: 'MC275',
        aspects: {
          Brand: ['McIntosh'],
          Model: ['MC275'],
          MPN: ['MC275'],
        },
      },
    });
  });

  it('maps Component Type into eBay Type when Type field is missing', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-TYPE',
      Make: 'Accuphase',
      Model: 'E-470',
      'Component Type': 'Integrated Amplifier',
    });

    expect(payload.inventoryItem).toMatchObject({
      sku: 'EBAY-SKU-TYPE',
      product: {
        type: 'Integrated Amplifier',
        aspects: {
          Type: ['Integrated Amplifier'],
        },
      },
    });
  });

  it('prefers Component Type array over Shopify Type taxonomy for eBay Type', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-TYPE-PREF',
      'Component Type': ['Stereo Receiver'],
      'Shopify Type': 'Electronics > Audio > Receivers',
    });

    expect(payload.inventoryItem).toMatchObject({
      sku: 'EBAY-SKU-TYPE-PREF',
      product: {
        type: 'Stereo Receiver',
        aspects: {
          Connectivity: ['Wired'],
          Type: ['Stereo Receiver'],
        },
      },
    });
  });

  it('maps explicit connectivity aliases into eBay Connectivity', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-CONNECTIVITY',
      Brand: 'KEF',
      Model: 'LSX II',
      Connectivity: 'Bluetooth',
    });

    expect(payload.inventoryItem).toMatchObject({
      sku: 'EBAY-SKU-CONNECTIVITY',
      product: {
        aspects: {
          Connectivity: ['Wireless'],
        },
      },
    });
  });

  it('infers Model from title when explicit model is missing', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-MODEL-INFER',
      Brand: 'Marantz',
      Title: 'Marantz 2270 - Fully Restored',
    });

    expect(payload.inventoryItem).toMatchObject({
      sku: 'EBAY-SKU-MODEL-INFER',
      product: {
        aspects: {
          Brand: ['Marantz'],
          Model: ['2270'],
        },
      },
    });
  });

  it('prefers explicit eBay aspects JSON when present', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-ASPECTS',
      'eBay Inventory Product Brand': 'Cardas',
      'eBay Inventory Product Aspects JSON': JSON.stringify({
        Brand: ['Cardas'],
        'Cable Type': ['Interconnect'],
        'Connector A Type': ['XLR Male'],
        'Connector B Type': ['XLR Female'],
        Model: ['Clear Beyond'],
      }),
      'Key Features (Key, Value)': 'Condition,Excellent\nFinish,Blue',
    });

    expect(payload.inventoryItem).toMatchObject({
      sku: 'EBAY-SKU-ASPECTS',
      product: {
        aspects: {
          Brand: ['Cardas'],
          'Cable Type': ['Interconnect'],
          'Connector A Type': ['XLR Male'],
          'Connector B Type': ['XLR Female'],
          Model: ['Clear Beyond'],
        },
      },
    });
  });

  it('uses workflow image metadata for eBay image urls', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-WORKFLOW-META',
      'Workflow Image Metadata JSON': JSON.stringify([
        {
          attachmentId: 'att-2',
          url: 'https://cdn.example.com/meta-b.jpg',
          filename: 'meta-b.jpg',
          alt: 'Rear angle',
          sortOrder: 1,
          sourceStage: 'photos',
          includedInListing: true,
        },
        {
          attachmentId: 'att-1',
          url: 'https://cdn.example.com/meta-a.jpg',
          filename: 'meta-a.jpg',
          alt: 'Front angle',
          sortOrder: 2,
          sourceStage: 'testing',
          includedInListing: true,
        },
      ]),
    });

    expect(payload.inventoryItem).toMatchObject({
      sku: 'EBAY-SKU-WORKFLOW-META',
      product: {
        imageUrls: ['https://cdn.example.com/meta-b.jpg', 'https://cdn.example.com/meta-a.jpg'],
      },
    });
  });

  it('excludes workflow metadata rows that are not marked for listing inclusion', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-WORKFLOW-INCLUSION',
      'Workflow Image Metadata JSON': JSON.stringify([
        {
          attachmentId: 'att-photos',
          url: 'https://cdn.example.com/meta-photos.jpg',
          filename: 'meta-photos.jpg',
          alt: 'Photos stage primary',
          sortOrder: 1,
          sourceStage: 'photos',
          includedInListing: true,
        },
        {
          attachmentId: 'att-testing',
          url: 'https://cdn.example.com/meta-testing.jpg',
          filename: 'meta-testing.jpg',
          alt: 'Testing stage reference',
          sortOrder: 2,
          sourceStage: 'testing',
          includedInListing: false,
        },
      ]),
    });

    expect(payload.inventoryItem).toMatchObject({
      sku: 'EBAY-SKU-WORKFLOW-INCLUSION',
      product: {
        imageUrls: ['https://cdn.example.com/meta-photos.jpg'],
      },
    });
  });

  it('maps Duration alias into eBay offer listingDuration', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-DURATION',
      Duration: 'DAYS_10',
    });

    expect(payload.offer).toMatchObject({
      sku: 'EBAY-SKU-DURATION',
      listingDuration: 'DAYS_10',
    });
  });

  it('prefers Airtable Body HTML for listingDescription while inventory description prefers plain Description', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-BODY-HTML',
      Description: 'Plain text fallback description',
      'Body HTML': '<p>Rich HTML description</p>',
    });

    expect(payload.inventoryItem).toMatchObject({
      sku: 'EBAY-SKU-BODY-HTML',
      product: {
        description: 'Plain text fallback description',
      },
    });

    expect(payload.offer).toMatchObject({
      sku: 'EBAY-SKU-BODY-HTML',
      listingDescription: '<p>Rich HTML description</p>',
    });
  });

    it('prefers eBay Body HTML over generic Body HTML for listingDescription while inventory description prefers plain Description', () => {
      const payload = buildEbayDraftPayloadBundleFromApprovalFields({
        'eBay Inventory SKU': 'EBAY-SKU-EBAY-BODY-HTML',
        'eBay Body HTML': '<p>eBay-specific HTML</p>',
        'Body HTML': '<p>Generic Body HTML</p>',
        Description: 'Plain text fallback description',
      });

      expect(payload.inventoryItem).toMatchObject({
        sku: 'EBAY-SKU-EBAY-BODY-HTML',
        product: {
          description: 'Plain text fallback description',
        },
      });

      expect(payload.offer).toMatchObject({
        sku: 'EBAY-SKU-EBAY-BODY-HTML',
        listingDescription: '<p>eBay-specific HTML</p>',
      });
    });

  it('always includes an offer format and defaults to FIXED_PRICE when Airtable is blank', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-DEFAULT-FORMAT',
      'eBay Offer Format': '',
    });

    expect(payload.offer).toMatchObject({
      sku: 'EBAY-SKU-DEFAULT-FORMAT',
      format: 'FIXED_PRICE',
    });
  });

  it('supports legacy Airtable alias "Ebay Body (HTML)" for listingDescription while inventory description prefers plain Description', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-EBAY-BODY-ALIAS',
      'Ebay Body (HTML)': '<p>Legacy Airtable eBay HTML</p>',
      Description: 'Plain text fallback description',
    });

    expect(payload.inventoryItem).toMatchObject({
      sku: 'EBAY-SKU-EBAY-BODY-ALIAS',
      product: {
        description: 'Plain text fallback description',
      },
    });

    expect(payload.offer).toMatchObject({
      sku: 'EBAY-SKU-EBAY-BODY-ALIAS',
      listingDescription: '<p>Legacy Airtable eBay HTML</p>',
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
      product: { imageUrls: [] },
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

  it('extracts numeric eBay category ids from human-readable category labels', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-8B',
      'Primary Category': 'Consumer Electronics > Vintage Audio & Video (293)',
      'Secondary Category': 'Receivers (14981)',
    });

    expect(payload.offer).toMatchObject({
      sku: 'EBAY-SKU-8B',
      categoryId: '293',
      secondaryCategoryId: '14981',
    });
  });

  it('ignores incidental numbers in category text that are not explicit eBay category ids', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-8C',
      'Primary Category': 'Vintage receiver lineup 2018 edition',
      'Secondary Category': 'classic 2-channel setup',
    });

    expect(payload.offer).toMatchObject({
      sku: 'EBAY-SKU-8C',
      categoryId: '14990',
      secondaryCategoryId: undefined,
    });
  });

  it('maps Airtable category alias fields into offer payload', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-8A',
      'Categories Airtable': '293, 11700',
    });

    expect(payload.offer).toMatchObject({
      sku: 'EBAY-SKU-8A',
      categoryId: '293',
      secondaryCategoryId: '11700',
    });
  });

  it('maps Ebay Price alias into fixed price listing payload', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-8P',
      'Ebay Price': 2299,
    });

    expect(payload.offer).toMatchObject({
      sku: 'EBAY-SKU-8P',
      pricingSummary: {
        price: {
          value: '2299',
          currency: 'USD',
        },
      },
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
      product: { imageUrls: [] },
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
      product: { imageUrls: [] },
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
      product: { imageUrls: [] },
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
      product: { imageUrls: [] },
    });
  });

  it('maps Images (comma-separated) into eBay imageUrls', () => {
    const payload = buildEbayDraftPayloadBundleFromApprovalFields({
      'eBay Inventory SKU': 'EBAY-SKU-14',
      'Images (comma-separated)': 'https://cdn.example.com/cs-a.jpg, https://cdn.example.com/cs-b.jpg',
    });

    expect(payload.inventoryItem).toMatchObject({
      sku: 'EBAY-SKU-14',
      product: { imageUrls: [] },
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
      product: { imageUrls: [] },
    });
  });
});
