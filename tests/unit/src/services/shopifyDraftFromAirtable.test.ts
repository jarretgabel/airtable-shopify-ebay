import {
  buildShopifyCollectionIdsFromApprovalFields,
  buildShopifyDraftProductFromApprovalFields,
} from '@/services/shopifyDraftFromAirtable';
import { buildShopifyUnifiedProductSetRequest } from '@/services/shopify';

describe('buildShopifyDraftProductFromApprovalFields', () => {
  it('uses workflow image metadata for listing images', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify Title': 'Workflow Metadata Product',
      'Workflow Image Metadata JSON': JSON.stringify([
        {
          attachmentId: 'att-2',
          url: 'https://cdn.example.com/metadata-b.jpg',
          filename: 'metadata-b.jpg',
          alt: 'Rear angle',
          sortOrder: 1,
          sourceStage: 'photos',
          includedInListing: true,
        },
        {
          attachmentId: 'att-1',
          url: 'https://cdn.example.com/metadata-a.jpg',
          filename: 'metadata-a.jpg',
          alt: 'Front angle',
          sortOrder: 2,
          sourceStage: 'testing',
          includedInListing: true,
        },
      ]),
    });

    expect(product.images).toEqual([
      { src: 'https://cdn.example.com/metadata-b.jpg', alt: 'Rear angle', position: 1 },
      { src: 'https://cdn.example.com/metadata-a.jpg', alt: 'Front angle', position: 2 },
    ]);
  });

  it('omits images when workflow metadata is missing', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify Title': 'No Metadata Product',
      Images: 'https://cdn.example.com/a.jpg',
    });

    expect(product.images).toBeUndefined();
  });

  it('uses only workflow metadata rows marked for listing inclusion', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Workflow Metadata Inclusion Product',
      Images: 'https://cdn.example.com/fallback.jpg',
      'Workflow Image Metadata JSON': JSON.stringify([
        {
          attachmentId: 'att-photos',
          url: 'https://cdn.example.com/photos-live.jpg',
          filename: 'photos-live.jpg',
          alt: 'Photos stage primary',
          sortOrder: 1,
          sourceStage: 'photos',
          includedInListing: true,
        },
        {
          attachmentId: 'att-testing',
          url: 'https://cdn.example.com/testing-hidden.jpg',
          filename: 'testing-hidden.jpg',
          alt: 'Testing stage reference',
          sortOrder: 2,
          sourceStage: 'testing',
          includedInListing: false,
        },
      ]),
    });

    expect(product.images).toEqual([
      { src: 'https://cdn.example.com/photos-live.jpg', alt: 'Photos stage primary', position: 1 },
    ]);
  });

  it('omits ProductSet image files when workflow metadata is missing', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify Title': 'Combined Preview Product',
      Images: JSON.stringify([
        { src: 'https://cdn.example.com/combined-a.jpg', alt: 'Combined A' },
      ]),
    });

    const request = buildShopifyUnifiedProductSetRequest(product);

    expect(request.input.files).toBeUndefined();
  });

  it('passes workflow metadata alt text into Shopify unified file payload', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify Title': 'Alt Text Payload Product',
      'Workflow Image Metadata JSON': JSON.stringify([
        {
          attachmentId: 'att-side',
          url: 'https://cdn.example.com/mc225-left-side.jpg',
          filename: 'mc225-left-side.jpg',
          alt: 'McIntosh MC225 Stereo Tube Power Amplifier Left Side',
          sortOrder: 1,
          sourceStage: 'photos',
          includedInListing: true,
        },
      ]),
    });

    const request = buildShopifyUnifiedProductSetRequest(product);

    expect(request.input.files).toEqual([
      {
        originalSource: 'https://cdn.example.com/mc225-left-side.jpg',
        alt: 'McIntosh MC225 Stereo Tube Power Amplifier Left Side',
        contentType: 'IMAGE',
      },
    ]);
  });

  it('does not use eBay-specific title fallback for Shopify payloads', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'eBay Inventory Product Title': 'Should Not Be Used',
      'eBay Inventory Product Brand': 'eBay Brand',
      'eBay Offer Price Value': '123.45',
    });

    expect(product.title).toBe('Untitled Listing');
    expect(product.vendor).toBe('Resolution Audio Video NYC');
    expect(product.variants?.[0]?.price).toBeUndefined();
  });

  it('omits variant price from the unified request when Airtable has no Shopify price', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Missing Price Product',
      'eBay Offer Price Value': '123.45',
    });

    const request = buildShopifyUnifiedProductSetRequest(product);

    expect(request.input.variants).toHaveLength(1);
    expect(request.input.variants?.[0]?.price).toBeUndefined();
  });

  it('maps canonical condition field into Shopify options and variant selection', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Shopify Condition Test',
      __Condition__: 'Open Box',
    });

    expect(product.options).toEqual([
      {
        name: 'Condition',
        position: 1,
        values: ['Open Box'],
      },
    ]);
    expect(product.variants?.[0]?.option1).toBe('Open Box');
  });

  it('uses Shopify vendor from Airtable fields and aggregates tags from Airtable tag fields', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Tag Product',
      'Shopify REST Vendor': 'Luxman',
      'Shopify REST Tag 1': 'Vintage Audio',
      'Shopify REST Tag 2': 'Turntable',
      'Shopify GraphQL Tags JSON': JSON.stringify(['vintage audio', 'Belt Drive']),
    });

    expect(product.vendor).toBe('Luxman');
    expect(product.tags).toBe('Vintage Audio, Turntable, Belt Drive');
  });

  it('falls back to default vendor when Airtable vendor fields are blank', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Fallback Vendor Product',
      'Shopify REST Vendor': '',
      Vendor: '',
      Brand: '',
      Manufacturer: '',
    });

    expect(product.vendor).toBe('Resolution Audio Video NYC');
  });

  it('maps generic Airtable Tags field into Shopify tags payload', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Generic Tags Product',
      'Tags': 'Vintage Audio, Turntable',
    });

    expect(product.tags).toBe('Vintage Audio, Turntable');
  });

  it('renders Shopify body HTML from template tokens and dynamic fields', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify Title': 'Marantz 2230 Receiver',
      'Shopify Vendor': 'Marantz',
      'Shopify Variant 1 Price': '1799.00',
      'Shopify Variant 1 SKU': 'MARANTZ-2230',
      '__Condition__': 'Used',
      'Shopify Body HTML Template': '<p>{{body_intro}}</p>{{body_highlights}}<p>Price: {{price}}</p><p>SKU: {{sku}}</p><p>{{vendor}} {{title}} ({{condition}})</p>',
      'Shopify Body Intro': 'Restored unit with warm analog sound.',
      'Shopify Body Highlights': 'Serviced controls\nOriginal wood case',
    });

    expect(product.body_html).toBe('<p>Restored unit with warm analog sound.</p><ul><li>Serviced controls</li><li>Original wood case</li></ul><p>Price: 1799.00</p><p>SKU: </p><p>Marantz Marantz 2230 Receiver (Used)</p>');
  });

  it('returns no body html when no template fields are provided', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify Title': 'Feature Product',
    });

    expect(product.body_html).toBeUndefined();
  });

  it('rebuilds body html directly from description and features when no dedicated template exists', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify Title': 'Structured Product',
      'Shopify Body Description': 'Updated description from form.',
      'Shopify Body Key Features JSON': JSON.stringify([
        { feature: 'Condition', value: 'Excellent' },
        { feature: 'Includes', value: 'Manual, remote' },
      ]),
    });

    expect(product.body_html).toBe('<p>Updated description from form.</p><ul><li><strong>Condition:</strong> Excellent</li><li><strong>Includes:</strong> Manual, remote</li></ul>{{body_key_features}}');
  });

  it('uses the dedicated body html template when one is provided', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify Title': 'Template Product',
      'Shopify Body HTML Template': '<div class="product-body"><p>Template description</p><ul><li><strong>Template:</strong> Value</li></ul><p class="footnote">Ships insured.</p></div>',
      'Shopify Body Description': 'Updated description from form.',
      'Shopify Body Key Features JSON': JSON.stringify([
        { feature: 'Condition', value: 'Excellent' },
        { feature: 'Includes', value: 'Manual, remote' },
      ]),
    });

    expect(product.body_html).toBe('<p>Updated description from form.</p>\n<ul><li><strong>Condition:</strong> Excellent</li><li><strong>Includes:</strong> Manual, remote</li></ul>');
  });

  it('strips dir and role attributes and unwraps spans from Airtable body html templates', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify Title': 'Airtable Template Product',
      'Shopify Body HTML Template': '<p dir="ltr"><span>Old description</span></p><h3 dir="ltr"><span>Key Features</span></h3><ul><li role="presentation" dir="ltr"><span>Old feature</span></li></ul><h3 dir="ltr"><span>Technical Specifications</span></h3><ul><li role="presentation" dir="ltr"><span>Ignore me</span></li></ul>',
      'Shopify Body Description': 'Updated description from form.',
      'Shopify Body Key Features JSON': JSON.stringify([
        { feature: 'Condition', value: 'Excellent' },
        { feature: 'Includes', value: 'Manual, remote' },
      ]),
    });

    expect(product.body_html).toBe('<p>Updated description from form.</p>\n<h3>Key Features</h3>\n<ul><li><strong>Condition:</strong> Excellent</li><li><strong>Includes:</strong> Manual, remote</li></ul>');
  });

  it('wraps multi-paragraph descriptions in separate p tags before the key features heading', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify Title': 'Multi Paragraph Product',
      'Shopify Body HTML Template': '<p dir="ltr"><span>Old description</span></p><h3 dir="ltr"><span>Key Features</span></h3><ul><li role="presentation" dir="ltr"><span>Old feature</span></li></ul><h3 dir="ltr"><span>Technical Specifications</span></h3><ul><li role="presentation" dir="ltr"><span>Ignore me</span></li></ul>',
      'Shopify Body Description': 'First paragraph.\n\nSecond paragraph.',
      'Shopify Body Key Features JSON': JSON.stringify([
        { feature: 'Condition', value: 'Excellent' },
      ]),
    });

    expect(product.body_html).toBe('<p>First paragraph.</p>\n<p>Second paragraph.</p>\n<h3>Key Features</h3>\n<ul><li><strong>Condition:</strong> Excellent</li></ul>');
  });

  it('uses br when description is empty and does not leak old Airtable copy or features', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Empty Description Product',
      'Shopify REST Body HTML': '<p dir="ltr"><span>A three-layer platter with resonance-reducing deadening rubber.</span></p><h3 dir="ltr"><span>Key Features</span></h3><ul><li role="presentation" dir="ltr"><span>Three-layer resonance-controlled platter</span></li></ul>',
      'Shopify Body Description': '',
      'Shopify Body Key Features JSON': '',
    });

    expect(product.body_html).toBeUndefined();
  });

  it('pulls key feature pairs from the Airtable Key Features column', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Airtable Key Features Product',
      Description: 'Pulled from Airtable description field.',
      'Key Features': 'Key,Value\nCondition,Excellent\nIncludes,"Dust cover, headshell, power cable"\nFinish,Silver',
    });

    expect(product.body_html).toBe('<p>Pulled from Airtable description field.</p><ul><li><strong>Condition:</strong> Excellent</li><li><strong>Includes:</strong> Dust cover, headshell, power cable</li><li><strong>Finish:</strong> Silver</li></ul>{{body_key_features}}');
  });

  it('lets manual auto-mapped key feature rows override listing-derived Shopify values', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Make Model Product',
      Description: 'Pulled from Airtable description field.',
      Make: 'Marantz',
      Model: '2270',
      'Component Type': 'Stereo Receiver',
      'Serial Number': 'SN-2270-4455',
      __Condition__: 'Used - Very Good',
      Manual: 'Included',
      'Original Box': 'Yes',
      Remote: 'Included',
      'Power Cable': 'Included',
      Voltage: '120V',
      Weight: '42 lbs',
      'Shipping Dims': '22x19x11',
      'Audiogon Rating': '8/10',
      'Internal Inclusion Notes': 'Original box',
      'Testing Cosmetic Notes': 'Light scratching on the case',
      'Testing Notes': 'Passed bench test.\nPhono stage is quiet.',
      'Key Features': 'Key,Value\nMake,Wrong Make\nModel,Wrong Model\nSerial Number,Wrong Serial\nCondition,Excellent\nIncludes,Wrong includes\nCosmetic Notes,Wrong cosmetics\nOriginal Box,Wrong box\nPower Cable,Wrong power cable\nManual,Wrong manual\nVoltage,Wrong voltage\nShipping Weight,Wrong weight\nShipping Dimensions,Wrong dims\nAudiogon Rating,Wrong rating\nFinish,Silver\nService History,Recapped in 2024',
    });

    expect(product.body_html).toContain('<p>Pulled from Airtable description field.</p>');
    expect(product.body_html).toContain('<li><strong>Make:</strong> Wrong Make</li>');
    expect(product.body_html).toContain('<li><strong>Service History:</strong> Recapped in 2024</li>');
    expect(product.body_html).toContain('<p><strong>Testing Notes:</strong> Passed bench test.<br />Phono stage is quiet.</p>');
  });

  it('auto-adds shipping weight and dimensions into Shopify body html key features', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Shipping Details Product',
      Description: 'Pulled from Airtable description field.',
      Weight: '42 lbs',
      'Shipping Dims': '22x19x11',
      'Key Features': 'Key,Value\nFinish,Silver',
    });

    expect(product.body_html).toContain('<li><strong>Shipping Weight:</strong> 42 lbs</li>');
    expect(product.body_html).toContain('<li><strong>Shipping Dimensions:</strong> 22x19x11</li>');
  });

  it('sends only the last segment of the Type breadcrumb as Shopify product_type', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Type Leaf Product',
      Type: 'Electronics > Audio > Audio Players & Recorders > Turntables & Record Players',
    });

    expect(product.product_type).toBe('Turntables & Record Players');
  });

  it('uses Airtable variant compare price as Shopify variant price in payload', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Compare Price Product',
      'Shopify REST Variant 1 Price': '299.00',
      'Variant-Compare-Price': '249.00',
    });

    expect(product.variants?.[0]?.price).toBe('249.00');
    expect(product.variants?.[0]?.compare_at_price).toBe('299.00');
  });

  it('maps the internal sku to the Shopify variant barcode', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Barcode From SKU Product',
      SKU: 'MCINTOSH-MA6900',
      'Shopify REST Variant 1 Barcode': 'SHOULD-NOT-WIN',
    });

    expect(product.variants?.[0]?.sku).toBe('MCINTOSH-MA6900');
    expect(product.variants?.[0]?.barcode).toBe('MCINTOSH-MA6900');
  });
  
  it('parses collection IDs from Airtable collection fields into Shopify GIDs', () => {
    const collectionIds = buildShopifyCollectionIdsFromApprovalFields({
      'Collection': '1234567890',
      'Shopify GraphQL Collection 2 ID': 'gid://shopify/Collection/222',
      'Shopify GraphQL Collections JSON': JSON.stringify([
        { collection_id: '333' },
        { id: 'gid://shopify/Collection/444' },
        '555',
      ]),
    });

    expect(collectionIds).toEqual([
      'gid://shopify/Collection/1234567890',
      'gid://shopify/Collection/333',
      'gid://shopify/Collection/444',
      'gid://shopify/Collection/555',
      'gid://shopify/Collection/222',
    ]);
  });
});
