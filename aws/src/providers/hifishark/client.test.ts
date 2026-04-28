import test from 'node:test';
import assert from 'node:assert/strict';
import { parseListingsFromHtml } from './client.js';

test('parseListingsFromHtml prefers embedded searchResults data and site-title mapping', () => {
  const html = `
    <html>
      <body>
        <a
          href="/goto/372_217972747/example-token"
          class="d-flex align-items-center search-product-row"
          title="Click to see this listing on Bazos Czechia"
        >Listing</a>
        <script>
          var searchResults = {
            "total": 1,
            "hits": [
              {
                "_id": "372_217972747",
                "description": "Accuphase E-530",
                "url": "/goto/372_217972747/example-token",
                "display_date_str": "Apr 25, 2026",
                "display_price": "CZK 249,000",
                "location": { "country_iso": "CZ" },
                "price": { "currency_iso": "CZK", "value": 249000 }
              }
            ]
          };
        </script>
      </body>
    </html>
  `;

  const listings = parseListingsFromHtml({ slug: 'accuphase-e-530', html });

  assert.equal(listings.length, 1);
  assert.deepEqual(listings[0], {
    id: '372_217972747',
    title: 'Accuphase E-530',
    site: 'Bazos Czechia',
    country: 'Czech Republic',
    price: 'CZK 249,000',
    priceNumeric: 249000,
    currency: 'CZK',
    listedDate: 'Apr 25, 2026',
    url: 'https://www.hifishark.com/goto/372_217972747/example-token',
  });
});

test('parseListingsFromHtml falls back to DOM row parsing when embedded searchResults is missing', () => {
  const html = `
    <html>
      <body>
        <table>
          <tr>
            <td>
              <a href="/goto/71_w1207791404/example-token">Accuphase E-530 ¥458,000 Nov 19, 2025</a>
            </td>
            <td>
              <img alt="Yahoo Auctions" />
              Japan
            </td>
            <td>¥458,000</td>
            <td>Nov 19, 2025</td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const listings = parseListingsFromHtml({ slug: 'accuphase-e-530', html });

  assert.equal(listings.length, 1);
  assert.deepEqual(listings[0], {
    id: 'accuphase-e-530-0',
    title: 'Accuphase E-530',
    site: 'Yahoo Auctions',
    country: 'Japan',
    price: '¥458,000',
    priceNumeric: 458000,
    currency: 'JPY',
    listedDate: 'Nov 19, 2025',
    url: 'https://www.hifishark.com/goto/71_w1207791404/example-token',
  });
});

test('parseListingsFromHtml falls back to DOM row parsing when embedded searchResults JSON is malformed', () => {
  const html = `
    <html>
      <body>
        <table>
          <tr>
            <td>
              <a href="/goto/239_3266993542-172-16298/example-token">Accuphase E-530 €8 Dec 7, 2025</a>
            </td>
            <td>
              <img alt="Kleinanzeigen" />
              Germany
            </td>
            <td>€8</td>
            <td>Dec 7, 2025</td>
          </tr>
        </table>
        <script>
          var searchResults = {"hits":[{"_id":"broken"}
        </script>
      </body>
    </html>
  `;

  const listings = parseListingsFromHtml({ slug: 'accuphase-e-530', html });

  assert.equal(listings.length, 1);
  assert.deepEqual(listings[0], {
    id: 'accuphase-e-530-0',
    title: 'Accuphase E-530',
    site: 'Kleinanzeigen',
    country: 'Germany',
    price: '€8',
    priceNumeric: 8,
    currency: 'EUR',
    listedDate: 'Dec 7, 2025',
    url: 'https://www.hifishark.com/goto/239_3266993542-172-16298/example-token',
  });
});