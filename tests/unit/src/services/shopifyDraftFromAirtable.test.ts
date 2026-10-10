import {
  buildShopifyCollectionIdsFromApprovalFields,
  buildShopifyDraftProductFromApprovalFields,
} from '@/services/shopifyDraftFromAirtable';
import { buildShopifyUnifiedProductSetRequest } from '@/services/shopify';

describe('buildShopifyDraftProductFromApprovalFields', () => {
  it('ignores Airtable image URLs and falls back to Google Drive metadata images', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Google Drive Image Product',
      'Shopify REST Images JSON': JSON.stringify([
        { src: 'https://v5.airtableusercontent.com/image.jpg', alt: 'Airtable image' },
      ]),
      'Workflow Image Metadata JSON': JSON.stringify([
        {
          url: 'https://drive.google.com/uc?export=view&id=drive-image',
          filename: 'drive-image.jpg',
          alt: 'Drive image',
          sortOrder: 1,
          sourceStage: 'photos',
          includedInListing: true,
        },
      ]),
    });

    expect(product.images).toEqual([
      {
        src: 'https://drive.google.com/uc?export=view&id=drive-image',
        alt: 'Drive image',
        position: 1,
      },
    ]);
  });

  it('uses workflow image metadata for listing images', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify Title': 'Workflow Metadata Product',
      'Workflow Image Metadata JSON': JSON.stringify([
        {
          attachmentId: 'att-2',
          url: 'https://drive.google.com/metadata-b.jpg',
          filename: 'metadata-b.jpg',
          alt: 'Rear angle',
          sortOrder: 1,
          sourceStage: 'photos',
          includedInListing: true,
        },
        {
          attachmentId: 'att-1',
          url: 'https://drive.google.com/metadata-a.jpg',
          filename: 'metadata-a.jpg',
          alt: 'Front angle',
          sortOrder: 2,
          sourceStage: 'testing',
          includedInListing: true,
        },
      ]),
    });

    expect(product.images).toEqual([
      { src: 'https://drive.google.com/metadata-b.jpg', alt: 'Rear angle', position: 1 },
      { src: 'https://drive.google.com/metadata-a.jpg', alt: 'Front angle', position: 2 },
    ]);
  });

  it('omits images when workflow metadata is missing', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify Title': 'No Metadata Product',
      Images: 'https://drive.google.com/a.jpg',
    });

    expect(product.images).toBeUndefined();
  });

  it('uses only workflow metadata rows marked for listing inclusion', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Workflow Metadata Inclusion Product',
      Images: 'https://drive.google.com/fallback.jpg',
      'Workflow Image Metadata JSON': JSON.stringify([
        {
          attachmentId: 'att-photos',
          url: 'https://drive.google.com/photos-live.jpg',
          filename: 'photos-live.jpg',
          alt: 'Photos stage primary',
          sortOrder: 1,
          sourceStage: 'photos',
          includedInListing: true,
        },
        {
          attachmentId: 'att-testing',
          url: 'https://drive.google.com/testing-hidden.jpg',
          filename: 'testing-hidden.jpg',
          alt: 'Testing stage reference',
          sortOrder: 2,
          sourceStage: 'testing',
          includedInListing: false,
        },
      ]),
    });

    expect(product.images).toEqual([
      { src: 'https://drive.google.com/photos-live.jpg', alt: 'Photos stage primary', position: 1 },
    ]);
  });

  it('omits ProductSet image files when workflow metadata is missing', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify Title': 'Combined Preview Product',
      Images: JSON.stringify([
        { src: 'https://drive.google.com/combined-a.jpg', alt: 'Combined A' },
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
          url: 'https://drive.google.com/mc225-left-side.jpg',
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
        originalSource: 'https://drive.google.com/mc225-left-side.jpg',
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

  it('maps the canonical shipping weight field to Shopify pounds measurement', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Shipping Weight Product',
      'Shipping Weight': '42 lbs',
    });

    const request = buildShopifyUnifiedProductSetRequest(product);

    expect(request.input.variants?.[0]?.inventoryItem?.measurement).toEqual({
      weight: { value: 42, unit: 'POUNDS' },
    });
  });

  it('maps separate shipping dimensions to product metafields', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Shipping Dimensions Product',
      'Shipping Width': '22 in',
      'Shipping Depth': '19',
      'Shipping Height': '11 inches',
    });

    const request = buildShopifyUnifiedProductSetRequest(product);

    expect(request.input.metafields).toEqual(expect.arrayContaining([
      { namespace: 'custom', key: 'shipping_width', type: 'number_decimal', value: '22' },
      { namespace: 'custom', key: 'shipping_depth', type: 'number_decimal', value: '19' },
      { namespace: 'custom', key: 'shipping_height', type: 'number_decimal', value: '11' },
    ]));
  });

  it('uses legacy bundled shipping dimensions only when separate fields are missing', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Legacy Shipping Dimensions Product',
      'Shipping Dims': '22x19x11',
      'Shipping Width': '24 in',
    });

    const request = buildShopifyUnifiedProductSetRequest(product);

    expect(request.input.metafields).toEqual(expect.arrayContaining([
      { namespace: 'custom', key: 'shipping_width', type: 'number_decimal', value: '24' },
      { namespace: 'custom', key: 'shipping_depth', type: 'number_decimal', value: '19' },
      { namespace: 'custom', key: 'shipping_height', type: 'number_decimal', value: '11' },
    ]));
  });

  it('adds Shopify default product options when variants have no option fields', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Optionless Product',
      'Shopify Price': '125.00',
    });

    const request = buildShopifyUnifiedProductSetRequest(product);

    expect(request.input.productOptions).toEqual([
      { name: 'Title', position: 1, values: [{ name: 'Default Title' }] },
    ]);
    expect(request.input.variants?.[0]?.optionValues).toEqual([
      { optionName: 'Title', name: 'Default Title' },
    ]);
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

  it('adds a default condition metafield for Shopify payloads', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Default Condition Metafield Product',
    });

    expect(product.metafields).toEqual(expect.arrayContaining([
      {
        namespace: 'custom',
        key: 'condition',
        type: 'single_line_text_field',
        value: 'Pre-Owned',
      },
    ]));
  });

  it('lets advanced Shopify metafield rows override the default condition metafield', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Override Condition Metafield Product',
      'Shopify REST Metafield 1 Namespace': 'custom',
      'Shopify REST Metafield 1 Key': 'condition',
      'Shopify REST Metafield 1 Type': 'single_line_text_field',
      'Shopify REST Metafield 1 Value': 'pre-owned',
    });

    const conditionMetafield = product.metafields?.find((metafield) => metafield.namespace === 'custom' && metafield.key === 'condition');
    expect(conditionMetafield).toEqual({
      namespace: 'custom',
      key: 'condition',
      type: 'single_line_text_field',
      value: 'pre-owned',
    });
  });

  it('lets friendly condition metafield value field override the default condition metafield', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Friendly Condition Metafield Product',
      'Shopify Condition Metafield Value': 'refurbished',
    });

    const conditionMetafield = product.metafields?.find((metafield) => metafield.namespace === 'custom' && metafield.key === 'condition');
    expect(conditionMetafield).toEqual({
      namespace: 'custom',
      key: 'condition',
      type: 'single_line_text_field',
      value: 'refurbished',
    });
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

    expect(product.body_html).toBe('<p>Updated description from form.</p><h3>Details &amp; Testing Notes</h3>\n<table><tbody><tr><th scope="row">Condition</th><td>Excellent</td></tr><tr><th scope="row">Includes</th><td>Manual, remote</td></tr></tbody></table>');
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

    expect(product.body_html).toBe('<p>Updated description from form.</p>\n<h3>Details &amp; Testing Notes</h3>\n<table><tbody><tr><th scope="row">Condition</th><td>Excellent</td></tr><tr><th scope="row">Includes</th><td>Manual, remote</td></tr></tbody></table>');
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

    expect(product.body_html).toBe('<p>Updated description from form.</p>\n<h3>Details &amp; Testing Notes</h3>\n<table><tbody><tr><th scope="row">Condition</th><td>Excellent</td></tr><tr><th scope="row">Includes</th><td>Manual, remote</td></tr></tbody></table>');
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

    expect(product.body_html).toBe('<p>First paragraph.</p>\n<p>Second paragraph.</p>\n<h3>Details &amp; Testing Notes</h3>\n<table><tbody><tr><th scope="row">Condition</th><td>Excellent</td></tr></tbody></table>');
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

    expect(product.body_html).toBe('<p>Pulled from Airtable description field.</p><h3>Details &amp; Testing Notes</h3>\n<table><tbody><tr><th scope="row">Condition</th><td>Excellent</td></tr><tr><th scope="row">Includes</th><td>Dust cover, headshell, power cable</td></tr><tr><th scope="row">Finish</th><td>Silver</td></tr></tbody></table>');
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
    expect(product.body_html).not.toContain('<th scope="row">Make</th>');
    expect(product.body_html).toContain('<tr><th scope="row">Service History</th><td>Recapped in 2024</td></tr>');
    expect(product.body_html).toContain('<tr><th scope="row">Testing Notes</th><td>Passed bench test.\nPhono stage is quiet.</td></tr>');
  });

  it('auto-adds shipping weight and dimensions into Shopify body html key features', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Shipping Details Product',
      Description: 'Pulled from Airtable description field.',
      Weight: '42 lbs',
      'Shipping Dims': '22x19x11',
      'Key Features': 'Key,Value\nFinish,Silver',
    });

    expect(product.body_html).toContain('<tr><th scope="row">Shipping Weight</th><td>42 lbs</td></tr>');
    expect(product.body_html).toContain('<tr><th scope="row">Shipping Dimensions</th><td>22x19x11</td></tr>');
  });

  it('orders the details table and omits inapplicable or high-rating rows', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'MIT Terminator 4 Speaker Cables',
      Description: 'Eight-foot bi-wire speaker cable pair.',
      'Component Type': 'Speaker Cables',
      'Audiogon Rating': '8/10: Very Good',
      'Cosmetic Notes': 'Minor handling marks',
      'Testing Notes': 'Functions as intended and sounds great.',
      'Serial Number': '',
      'Original Box': 'Yes',
      Manual: 'No',
      'Power Cable': 'Yes',
      'Additional Items': 'Protective sleeves',
      'Shipping Method': 'UPS Ground',
      'Shipping Weight': '6 lbs',
      'Shipping Dims': '20x18x10',
      'Key Features': 'Termination,Spade to banana\nLength,8 ft',
    });

    expect(product.body_html).toContain('<h3>Details &amp; Testing Notes</h3>');
    expect(product.body_html).not.toContain('Cosmetic Notes');
    expect(product.body_html).not.toContain('<th scope="row">Power Cable</th>');
    expect(product.body_html).toMatch(/Audiogon Rating[\s\S]*Testing Notes[\s\S]*Serial Number[\s\S]*Termination[\s\S]*Length[\s\S]*Original Box[\s\S]*Original Manual[\s\S]*Additional Items[\s\S]*Shipping Method[\s\S]*Shipping Weight[\s\S]*Shipping Dimensions/);
    expect(product.body_html).toContain('<tr><th scope="row">Serial Number</th><td></td></tr>');
  });

  it('sends only the last segment of the Type breadcrumb as Shopify product_type', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Type Leaf Product',
      Type: 'Electronics > Audio > Audio Players & Recorders > Turntables & Record Players',
    });

    expect(product.product_type).toBe('Turntables & Record Players');
  });

  it('uses Airtable variant price as Shopify variant price and compare price as compare_at_price', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Compare Price Product',
      'Shopify REST Variant 1 Price': '249.00',
      'Variant-Compare-Price': '299.00',
    });

    expect(product.variants?.[0]?.price).toBe('249.00');
    expect(product.variants?.[0]?.compare_at_price).toBe('299.00');
  });

  it('maps Shopify Price and Available aliases into variant price and inventory quantity', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Alias Price Quantity Product',
      'Shopify Price': '1599.00',
      Available: '3',
    });

    expect(product.variants?.[0]?.price).toBe('1599.00');
    expect(product.variants?.[0]?.inventory_quantity).toBe(3);
  });

  it('maps the shared Quantity field into Shopify variant inventory quantity', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Shared Quantity Product',
      Quantity: '1',
    });

    expect(product.variants?.[0]?.inventory_quantity).toBe(1);
  });

  it('prefers canonical Shopify inventory quantity over legacy aliases in ProductSet payloads', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Canonical Quantity Product',
      'Shopify Inventory Quantity': 7,
      'Shopify Variant 1 Inventory Quantity': 2,
    });

    const request = buildShopifyUnifiedProductSetRequest(product);

    expect(product.variants?.[0]?.inventory_quantity).toBe(7);
    expect(request.input.variants?.[0]?.inventoryItem?.tracked).toBe(true);
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

  it('includes condition metafield in unified ProductSet payload by default', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Unified Metafield Default Product',
    });

    const request = buildShopifyUnifiedProductSetRequest(product);
    const conditionMetafield = request.input.metafields?.find((metafield) => metafield.namespace === 'custom' && metafield.key === 'condition');

    expect(conditionMetafield).toEqual({
      namespace: 'custom',
      key: 'condition',
      type: 'single_line_text_field',
      value: 'Pre-Owned',
    });
  });

  it('keeps explicit condition metafield override in unified ProductSet payload', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Unified Metafield Override Product',
      'Shopify Condition Metafield Value': 'Like New',
    });

    const request = buildShopifyUnifiedProductSetRequest(product);
    const conditionMetafield = request.input.metafields?.find((metafield) => metafield.namespace === 'custom' && metafield.key === 'condition');

    expect(conditionMetafield).toEqual({
      namespace: 'custom',
      key: 'condition',
      type: 'single_line_text_field',
      value: 'Like New',
    });
  });
});
