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
        { feature: 'Condition', value: 'Very Good' },
        { feature: 'Serial', value: '12345' },
      ]),
      '',
    );

    expect(html).toContain('<tr><th>Condition</th><td>Very Good</td></tr>');
    expect(html).toContain('<tr><th>Serial</th><td>12345</td></tr>');
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

  it('renders plain Testing form text into the testing notes table', () => {
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

  it('adds Make and Model to the top key features table without duplicating manual key feature rows', () => {
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
      ]),
      '',
      'McIntosh',
      'MC275',
    );

    expect(html).toContain('<tr><th>Make</th><td>McIntosh</td></tr>');
    expect(html).toContain('<tr><th>Model</th><td>MC275</td></tr>');
    expect(html).toContain('<tr><th>Condition</th><td>Very Good</td></tr>');
    expect(html).not.toContain('Wrong Make');
    expect(html).not.toContain('Wrong Model');
  });
});
