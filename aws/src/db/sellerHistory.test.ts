import assert from 'node:assert/strict';
import test from 'node:test';
import { getSellerHistory } from './sellerHistory.js';

test('returns null for a blank email without querying', async () => {
  const db = { query: async () => { throw new Error('must not query'); } };
  assert.equal(await getSellerHistory(db, '  '), null);
});

test('returns null when no contact matches', async () => {
  const db = { query: async () => ({ rows: [] }) };
  assert.equal(await getSellerHistory(db, 'a@x.com'), null);
});

test('assembles contact, items, totals and related rows', async () => {
  const answers: Array<Array<Record<string, unknown>>> = [
    [{ id: 'c1', email: 'a@x.com', alternate_emails: ['b@x.com'], name: 'A', phone: null, location: 'NYC', mailing_list_opt_in: true }],
    [{ airtable_record_id: 'r1', sku: '1', make: 'McIntosh', model: 'MC275', workflow_status: 'Listed', arrival_date: '2026-03-01', paid_amount: '500', post_sale_outcome: null }],
    [{ items: 1, paid: '500', refunded: '0' }],
    [{ kind: 'call', occurred_at: '2026-03-02', summary: 'x' }],
    [{ due_at: '2026-04-01', note: null }],
    [{ open: 2 }],
  ];
  const db = { query: async () => ({ rows: answers.shift() ?? [] }) };
  const history = await getSellerHistory(db, ' A@X.com ');
  assert.equal(history?.contact.alternateEmails[0], 'b@x.com');
  assert.deepEqual(history?.totals, { items: 1, paidAmount: 500, refundAmount: 0 });
  assert.equal(history?.items[0].paidAmount, 500);
  assert.equal(history?.openInquiries, 2);
  assert.equal(history?.openFollowUps.length, 1);
});
