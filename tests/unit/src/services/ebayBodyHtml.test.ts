import { buildEbayBodyHtmlFromTemplate } from '@/services/ebayBodyHtml';

describe('buildEbayBodyHtmlFromTemplate', () => {
  it('replaces title and description tokens', () => {
    const html = buildEbayBodyHtmlFromTemplate(
      '<h1>{{title}}</h1><div>{{description}}</div>',
      'McIntosh MC275',
      'Tube amp description',
      '',
      '',
    );

    expect(html).toBe('<h1>McIntosh MC275</h1><div>Tube amp description</div>');
  });

  it('maps key feature entries from template row and removes template placeholders', () => {
    const template = [
      '<table id="key-features">',
      '  <tbody>',
      '    <tr><th>{{key}}</th><td>{{value}}</td></tr>',
      '  </tbody>',
      '</table>',
    ].join('\n');

    const html = buildEbayBodyHtmlFromTemplate(
      template,
      '',
      '',
      JSON.stringify([
        { feature: 'Finish', value: 'Silver' },
        { feature: 'Serial', value: '12345' },
      ]),
      '',
    );

    expect(html).toContain('<tr><th>Finish</th><td>Silver</td></tr>');
    expect(html).toContain('<tr><th>Serial</th><td>12345</td></tr>');
    expect(html).not.toContain('<tr><th>Serial Number</th>');
    expect(html).not.toContain('{{key}}');
    expect(html).not.toContain('{{value}}');
  });

  it('renders testing notes into a dedicated table without overwriting key features', () => {
    const template = [
      '<table id="key-features">',
      '  <tbody>',
      '    <tr><th>{{key}}</th><td>{{value}}</td></tr>',
      '  </tbody>',
      '</table>',
      '<table id="testing-notes">',
      '  <tbody>',
      '    <tr><th>{{key}}</th><td>{{value}}</td></tr>',
      '  </tbody>',
      '</table>',
    ].join('\n');

    const html = buildEbayBodyHtmlFromTemplate(
      template,
      '',
      '',
      JSON.stringify([{ feature: 'Brand', value: 'McIntosh' }]),
      JSON.stringify([{ feature: 'Functional Notes', value: 'Fully tested.' }]),
    );

    expect(html).toContain('<table id="key-features">');
    expect(html).toContain('<tr><th>Brand</th><td>McIntosh</td></tr>');
    expect(html).toContain('<table id="testing-notes">');
    expect(html).toContain('<tr><th>Functional Notes</th><td>Fully tested.</td></tr>');
  });

  it('renders plain Testing form text into the ordered details rows', () => {
    const template = [
      '<table id="testing-notes">',
      '  <tbody>',
      '    <tr><th>{{key}}</th><td>{{value}}</td></tr>',
      '  </tbody>',
      '</table>',
    ].join('\n');

    const html = buildEbayBodyHtmlFromTemplate(
      template,
      '',
      '',
      '',
      'Passed bench test.\nLamp replaced.',
    );

    expect(html).toContain('<tr><th>Testing Notes</th><td>Passed bench test.<br />Lamp replaced.</td></tr>');
  });

  it('keeps colon-containing testing prose in a single testing-notes row', () => {
    const template = [
      '<table id="testing-notes">',
      '  <tbody>',
      '    <tr><th>{{key}}</th><td>{{value}}</td></tr>',
      '  </tbody>',
      '</table>',
    ].join('\n');

    const html = buildEbayBodyHtmlFromTemplate(
      template,
      '',
      '',
      '',
      'Passed extended bench and listening tests. Bias and DC offset are stable:\ntuner locks cleanly and the phono stage is quiet',
    );

    expect(html).toContain('<tr><th>Testing Notes</th><td>Passed extended bench and listening tests. Bias and DC offset are stable:<br />tuner locks cleanly and the phono stage is quiet</td></tr>');
  });

  it('removes redundant and reserved rows while preserving Other Key Features in the middle', () => {
    const template = [
      '<table id="key-features">',
      '  <tbody>',
      '    <tr><th>{{key}}</th><td>{{value}}</td></tr>',
      '  </tbody>',
      '</table>',
    ].join('\n');

    const html = buildEbayBodyHtmlFromTemplate(
      template,
      '',
      '',
      JSON.stringify([
        { feature: 'Make', value: 'Wrong Make' },
        { feature: 'Model', value: 'Wrong Model' },
        { feature: 'Condition', value: 'Very Good' },
        { feature: 'Finish', value: 'Silver' },
        { feature: 'Service History', value: 'Recapped in 2024' },
      ]),
      '',
      'McIntosh',
      'MC275',
      {
        componentType: 'Tube Amplifier',
      },
    );

    expect(html).not.toContain('<tr><th>Make</th>');
    expect(html).not.toContain('<tr><th>Model</th>');
    expect(html).not.toContain('<tr><th>Component Type</th>');
    expect(html).not.toContain('<tr><th>Condition</th>');
    expect(html).toContain('<tr><th>Finish</th><td>Silver</td></tr>');
    expect(html).toContain('<tr><th>Service History</th><td>Recapped in 2024</td></tr>');
    expect(html).toMatch(/<tr><th>Finish<\/th><td>Silver<\/td><\/tr>\n<tr><th>Service History<\/th><td>Recapped in 2024<\/td><\/tr>/);
  });

  it('orders the requested leading, middle, and trailing detail rows', () => {
    const template = [
      '<table id="key-features">',
      '  <tbody>',
      '    <tr><th>{{key}}</th><td>{{value}}</td></tr>',
      '  </tbody>',
      '</table>',
      '<table id="testing-notes">',
      '  <tbody>',
      '    <tr><th>{{key}}</th><td>{{value}}</td></tr>',
      '  </tbody>',
      '</table>',
    ].join('\n');

    const html = buildEbayBodyHtmlFromTemplate(
      template,
      '',
      '',
      JSON.stringify([
        { feature: 'Serial Number', value: 'Wrong Serial' },
        { feature: 'Condition', value: 'Wrong Condition' },
        { feature: 'Original Box', value: 'Wrong Box' },
        { feature: 'Manual', value: 'Wrong Manual' },
      ]),
      JSON.stringify([
        { feature: 'Voltage', value: 'Wrong Voltage' },
        { feature: 'Audiogon Rating', value: 'Wrong Rating' },
        { feature: 'Testing Notes', value: 'Fully tested.' },
      ]),
      'Marantz',
      '2270',
      {
        componentType: 'Integrated Amplifier',
        serialNumber: 'SN-2270-4455',
        cosmeticNotes: 'Light scratching on the case',
        originalBox: 'Yes',
        powerCable: 'Included',
        manual: 'Included',
        voltage: '120V',
        additionalItems: 'Remote control',
        shippingMethod: 'UPS Ground',
        shippingWeight: '42 lbs',
        shippingDimensions: '22x19x11',
        audiogonRating: '8/10',
      },
    );

    expect(html).toMatch(/<tr><th>Audiogon Rating<\/th><td>8\/10<\/td><\/tr>\n<tr><th>Testing Notes<\/th><td>Fully tested\.<\/td><\/tr>\n<tr><th>Serial Number<\/th><td>SN-2270-4455<\/td><\/tr>\n<tr><th>Voltage<\/th><td>120V<\/td><\/tr>/);
    expect(html).toMatch(/<tr><th>Original Box<\/th><td>Yes<\/td><\/tr>\n<tr><th>Original Manual<\/th><td>Included<\/td><\/tr>\n<tr><th>Power Cable<\/th><td>Included<\/td><\/tr>\n<tr><th>Additional Items<\/th><td>Remote control<\/td><\/tr>\n<tr><th>Shipping Method<\/th><td>UPS Ground<\/td><\/tr>\n<tr><th>Shipping Weight<\/th><td>42 lbs<\/td><\/tr>\n<tr><th>Shipping Dimensions<\/th><td>22x19x11<\/td><\/tr>/);
    expect(html).not.toContain('<tr><th>Cosmetic Notes</th>');
    expect(html).not.toContain('<tr><th>Condition</th>');
  });

  it('shows cosmetic notes at rating 7 or below and suppresses Power Cable for cables', () => {
    const template = [
      '<table id="testing-notes">',
      '  <tbody>',
      '    <tr><th>{{key}}</th><td>{{value}}</td></tr>',
      '  </tbody>',
      '</table>',
    ].join('\n');

    const html = buildEbayBodyHtmlFromTemplate(
      template,
      '',
      '',
      '',
      JSON.stringify([
        { feature: 'Testing Notes', value: 'Fully tested.' },
        { feature: 'Bias', value: 'Stable' },
      ]),
      '',
      '',
      {
        componentType: 'Speaker Cables',
        cosmeticNotes: 'Visible jacket wear.',
        powerCable: 'Included',
        audiogonRating: '7/10',
      },
    );

    expect(html).toMatch(/<tr><th>Audiogon Rating<\/th><td>7\/10<\/td><\/tr>\n<tr><th>Cosmetic Notes<\/th><td>Visible jacket wear\.<\/td><\/tr>\n<tr><th>Testing Notes<\/th><td>Fully tested\.<\/td><\/tr>\n<tr><th>Bias<\/th><td>Stable<\/td><\/tr>/);
    expect(html).not.toContain('<tr><th>Power Cable</th>');
  });

  it('auto-adds shipping weight and dimensions at the end of the eBay details tables', () => {
    const template = [
      '<table id="key-features">',
      '  <tbody>',
      '    <tr><th>{{key}}</th><td>{{value}}</td></tr>',
      '  </tbody>',
      '</table>',
    ].join('\n');

    const html = buildEbayBodyHtmlFromTemplate(
      template,
      '',
      '',
      JSON.stringify([{ feature: 'Finish', value: 'Silver' }]),
      '',
      '',
      '',
      {
        shippingWeight: '42 lbs',
        shippingDimensions: '22x19x11',
      },
    );

    expect(html).toContain('<tr><th>Shipping Weight</th><td>42 lbs</td></tr>');
    expect(html).toContain('<tr><th>Shipping Dimensions</th><td>22x19x11</td></tr>');
    expect(html).toContain('<tr><th>Finish</th><td>Silver</td></tr>');
  });
});
