import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeListing, num, phoneKey, timestamp } from './normalize.js';
import { mergeContacts } from './normalizeApply.js';

test('timestamp accepts date-only and ISO values and rejects junk', () => {
  assert.equal(timestamp('2026-10-15'), '2026-10-15T00:00:00.000Z');
  assert.equal(timestamp('2026-10-13T23:55:40.636Z'), '2026-10-13T23:55:40.636Z');
  assert.equal(timestamp('not a date'), null);
  assert.equal(timestamp(undefined), null);
});

test('num parses currency strings and rejects non-numbers', () => {
  assert.equal(num('$1,250.50'), 1250.5);
  assert.equal(num(142), 142);
  assert.equal(num(''), null);
  assert.equal(num('abc'), null);
});

test('normalizeListing maps item, contact, listings, history and images', () => {
  const result = normalizeListing({
    'Seller Email': '  Seller@Example.COM ',
    'Seller Phone': '203-555-0100',
    'Mailing List Opt In': true,
    Make: 'Marantz',
    Model: '2225',
    SKU: { text: '11437' },
    'Component Type': ['RCA', 'pair'],
    Cost: 142,
    'Arrival Date': '2025-06-02',
    'Workflow Status': 'Listed',
    'eBay Listing ID': '237',
    'eBay Published At': '2026-10-13T23:55:40.636Z',
    'Shopify REST Product ID': '999',
    'Shopify Closed At': '2026-10-15',
    'Testing Signed At': '2026-08-13T17:04:26.820Z',
    'Testing Signed By': 'Sam',
    'Accepted At': '2026-05-03T14:00:00.000Z',
    Images: [{ id: 'att1', url: 'https://example.com/a.jpg' }],
  });

  assert.equal(result.contact?.email, 'seller@example.com');
  assert.equal(result.contact?.mailingListOptIn, true);
  assert.equal(result.item.sku, '11437');
  assert.deepEqual(result.item.componentType, ['RCA', 'pair']);
  assert.equal(result.item.arrivalDate, '2025-06-02');
  assert.deepEqual(result.listings.map((l) => [l.channel, l.status]), [['ebay', 'published'], ['shopify', 'closed']]);
  assert.deepEqual(result.statusHistory.map((h) => h.status), ['Accepted', 'Testing Signed']);
  assert.equal(result.statusHistory[1].changedBy, 'Sam');
  assert.equal(result.images.length, 1);
  assert.equal(result.images[0].position, 0);
});

test('normalizeListing tolerates empty records', () => {
  const result = normalizeListing({});
  assert.equal(result.contact, null);
  assert.deepEqual(result.listings, []);
  assert.deepEqual(result.statusHistory, []);
  assert.deepEqual(result.images, []);
});

test('normalizeListing ignores invalid emails', () => {
  assert.equal(normalizeListing({ 'Seller Email': 'not-an-email' }).contact, null);
});

const base = { phone: null, zipCode: null, location: null, howDidYouHear: null, mailingListOptIn: false };

test('mergeContacts de-duplicates by email, newest value wins, opt-in is sticky', () => {
  const { contacts } = mergeContacts([
    { ...base, email: 'a@x.com', phone: '111', mailingListOptIn: true },
    { ...base, email: 'a@x.com', phone: '222' },
    { ...base, email: 'b@x.com' },
  ]);
  assert.equal(contacts.length, 2);
  const a = contacts.find((c) => c.email === 'a@x.com')!;
  assert.equal(a.phone, '222');
  assert.equal(a.mailingListOptIn, true);
});

test('mergeContacts merges a new email that shares a phone and keeps both emails', () => {
  const { contacts, primaryByEmail } = mergeContacts([
    { ...base, email: 'tom@gmail.com', phone: '(949) 632-7821' },
    { ...base, email: 'tom@gmail.com', phone: '949-632-7821' },
    { ...base, email: 'tom@gmial.com', phone: '9496327821' },
  ]);
  assert.equal(contacts.length, 1);
  assert.equal(contacts[0].email, 'tom@gmail.com');
  assert.deepEqual(contacts[0].alternateEmails, ['tom@gmial.com']);
  assert.equal(primaryByEmail.get('tom@gmial.com'), 'tom@gmail.com');
});

test('mergeContacts never merges on short phones or on a phone shared by unrelated emails', () => {
  const short = mergeContacts([
    { ...base, email: 'alice@x.com', phone: '203895051' },
    { ...base, email: 'alica@x.com', phone: '203895051' },
  ]);
  assert.equal(short.contacts.length, 2);

  const ambiguous = mergeContacts([
    { ...base, email: 'alice@x.com', phone: '2125550100' },
    { ...base, email: 'robert@y.com', phone: '2125550100' },
    { ...base, email: 'carol@z.com', phone: '2125550100' },
  ]);
  assert.equal(ambiguous.contacts.length, 3);
});

test('phoneKey strips formatting and a leading country code', () => {
  assert.equal(phoneKey('+1 (203) 555-0100'), '2035550100');
  assert.equal(phoneKey('10001'), null);
});
