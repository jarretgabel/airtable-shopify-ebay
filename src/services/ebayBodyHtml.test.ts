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
});
