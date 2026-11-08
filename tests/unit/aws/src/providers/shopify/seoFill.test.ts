import assert from 'node:assert/strict';
import test from 'node:test';
import { fillSeoFieldsForPublish } from '../../../../../../aws/src/providers/shopify/seoFill.js';

const title = async () => 'Accuphase A-300 Mono Power Amplifier | Pre-Owned';
const description = async () => 'Pre-owned Accuphase A-300 Class A mono power amplifier in excellent condition, serviced and ready to ship from Brooklyn.';
const generators = { title, description };

test('fills blank SEO title and description', async () => {
  const result = await fillSeoFieldsForPublish({ Title: 'Accuphase A-300', Brand: 'Accuphase' }, generators);
  assert.equal(result.seoTitle, await title());
  assert.equal(result.seoDescription, await description());
});

test('keeps values already inside the SEO range', async () => {
  const result = await fillSeoFieldsForPublish({
    Title: 'Accuphase A-300',
    'Shopify Extra SEO Title': 'Accuphase A-300 Mono Power Amplifier',
    'Shopify Extra SEO Description': 'Pre-owned Accuphase A-300 Class A mono power amplifier, serviced, with a warranty. Ships from Brooklyn.',
  }, generators);
  assert.equal(result.seoTitle, undefined);
  assert.equal(result.seoDescription, undefined);
});

test('regenerates values outside the range', async () => {
  const result = await fillSeoFieldsForPublish({ Title: 'Accuphase A-300', 'Shopify Extra SEO Title': 'A-300', 'Shopify Extra SEO Description': 'x'.repeat(200) }, generators);
  assert.equal(result.seoTitle, await title());
  assert.equal(result.seoDescription, await description());
});

test('a generator failure leaves values unchanged and warns', async () => {
  const failing = async () => { throw new Error('boom'); };
  const result = await fillSeoFieldsForPublish({ Title: 'Accuphase A-300' }, { title: failing, description: failing });
  assert.equal(result.seoTitle, undefined);
  assert.equal(result.warnings.length, 2);
});
