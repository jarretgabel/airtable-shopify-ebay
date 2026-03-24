import { buildShopifyDraftProductFromApprovalFields } from '@/services/shopifyDraftFromAirtable';

describe('buildShopifyDraftProductFromApprovalFields', () => {
  it('preserves image alt text from JSON image objects', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Shopify Test Product',
      'Shopify REST Images JSON': JSON.stringify([
        { src: 'https://cdn.example.com/a.jpg', alt: 'Front view' },
        { src: 'https://cdn.example.com/b.jpg', alt: 'Back view' },
      ]),
    });

    expect(product.title).toBe('Shopify Test Product');
    expect(product.images).toEqual([
      { src: 'https://cdn.example.com/a.jpg', alt: 'Front view', position: 1 },
      { src: 'https://cdn.example.com/b.jpg', alt: 'Back view', position: 2 },
    ]);
  });

  it('normalizes string image arrays to objects with alt key', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Shopify Test Product',
      'Shopify REST Images JSON': JSON.stringify([
        'https://cdn.example.com/a.jpg',
        'https://cdn.example.com/b.jpg',
      ]),
    });

    expect(product.images).toEqual([
      { src: 'https://cdn.example.com/a.jpg', alt: '', position: 1 },
      { src: 'https://cdn.example.com/b.jpg', alt: '', position: 2 },
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
    expect(product.variants?.[0]?.price).toBe('0.00');
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

  it('forces the Shopify vendor and aggregates tags from Airtable tag fields', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Tag Product',
      'Shopify REST Vendor': 'Do Not Use',
      'Shopify REST Tag 1': 'Vintage Audio',
      'Shopify REST Tag 2': 'Turntable',
      'Shopify GraphQL Tags JSON': JSON.stringify(['vintage audio', 'Belt Drive']),
    });

    expect(product.vendor).toBe('Resolution Audio Video NYC');
    expect(product.tags).toBe('Vintage Audio, Turntable, Belt Drive');
  });

  it('renders Shopify body HTML from template tokens and dynamic fields', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Marantz 2230 Receiver',
      'Shopify REST Vendor': 'Marantz',
      'Shopify REST Variant 1 Price': '1799.00',
      'Shopify REST Variant 1 SKU': 'MARANTZ-2230',
      '__Condition__': 'Used',
      'Shopify REST Body HTML Template': '<p>{{body_intro}}</p>{{body_highlights}}<p>Price: {{price}}</p><p>SKU: {{sku}}</p><p>{{vendor}} {{title}} ({{condition}})</p>',
      'Shopify Body Intro': 'Restored unit with warm analog sound.',
      'Shopify Body Highlights': 'Serviced controls\nOriginal wood case',
    });

    expect(product.body_html).toBe('<p>Restored unit with warm analog sound.</p><ul><li>Serviced controls</li><li>Original wood case</li></ul><p>Price: 1799.00</p><p>SKU: MARANTZ-2230</p><p>Resolution Audio Video NYC Marantz 2230 Receiver (Used)</p>');
  });

  it('keeps legacy body_html unchanged when no template token is present', () => {
    const legacyHtml = '<p>Legacy HTML that should stay unchanged.</p>';
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Legacy Product',
      'Shopify REST Body HTML': legacyHtml,
      'Shopify Body Intro': 'Should not be injected without a tokenized template',
    });

    expect(product.body_html).toBe(legacyHtml);
  });

  it('rebuilds body html from description and key features for legacy non-templated body html', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Feature Product',
      'Shopify REST Body HTML': '<p>Legacy base block.</p>',
      'Shopify Body Description': 'Freshly serviced and bench tested.',
      'Shopify Body Key Features JSON': JSON.stringify([
        { feature: 'Condition', value: 'Used Excellent' },
        { feature: 'Includes', value: 'Remote, power cable' },
      ]),
    });

    expect(product.body_html).toBe('<p>Freshly serviced and bench tested.</p>\n<ul><li><strong>Condition:</strong> Used Excellent</li><li><strong>Includes:</strong> Remote, power cable</li></ul>');
  });

  it('rebuilds body html directly from description and features when no dedicated template exists', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Structured Product',
      'Shopify REST Body HTML': '<div class="product-body"><p>Old description</p><ul><li><strong>Old:</strong> Value</li></ul><p class="footnote">Ships insured.</p></div>',
      'Shopify Body Description': 'Updated description from form.',
      'Shopify Body Key Features JSON': JSON.stringify([
        { feature: 'Condition', value: 'Excellent' },
        { feature: 'Includes', value: 'Manual, remote' },
      ]),
    });

    expect(product.body_html).toBe('<p>Updated description from form.</p>\n<ul><li><strong>Condition:</strong> Excellent</li><li><strong>Includes:</strong> Manual, remote</li></ul>');
  });

  it('uses the dedicated body html template when one is provided', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Template Product',
      'Shopify REST Body HTML': '<div class="product-body"><p>Old description</p><ul><li><strong>Old:</strong> Value</li></ul><p class="footnote">Ships insured.</p></div>',
      'Shopify REST Body HTML Template': '<div class="product-body"><p>Template description</p><ul><li><strong>Template:</strong> Value</li></ul><p class="footnote">Ships insured.</p></div>',
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
      'Shopify REST Title': 'Airtable Template Product',
      'Shopify REST Body HTML': '<p dir="ltr"><span>Old description</span></p><h3 dir="ltr"><span>Key Features</span></h3><ul><li role="presentation" dir="ltr"><span>Old feature</span></li></ul><h3 dir="ltr"><span>Technical Specifications</span></h3><ul><li role="presentation" dir="ltr"><span>Ignore me</span></li></ul>',
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
      'Shopify REST Title': 'Multi Paragraph Product',
      'Shopify REST Body HTML': '<p dir="ltr"><span>Old description</span></p><h3 dir="ltr"><span>Key Features</span></h3><ul><li role="presentation" dir="ltr"><span>Old feature</span></li></ul><h3 dir="ltr"><span>Technical Specifications</span></h3><ul><li role="presentation" dir="ltr"><span>Ignore me</span></li></ul>',
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

    expect(product.body_html).toBe('<br>');
  });

  it('pulls key feature pairs from the Airtable Key Features column', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Airtable Key Features Product',
      Description: 'Pulled from Airtable description field.',
      'Key Features': 'Key,Value\nCondition,Excellent\nIncludes,"Dust cover, headshell, power cable"\nFinish,Silver',
    });

    expect(product.body_html).toBe('<p>Pulled from Airtable description field.</p>\n<ul><li><strong>Condition:</strong> Excellent</li><li><strong>Includes:</strong> Dust cover, headshell, power cable</li><li><strong>Finish:</strong> Silver</li></ul>');
  });

  it('sends only the last segment of the Type breadcrumb as Shopify product_type', () => {
    const product = buildShopifyDraftProductFromApprovalFields({
      'Shopify REST Title': 'Type Leaf Product',
      Type: 'Electronics > Audio > Audio Players & Recorders > Turntables & Record Players',
    });

    expect(product.product_type).toBe('Turntables & Record Players');
  });
});
