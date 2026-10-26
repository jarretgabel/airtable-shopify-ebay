import assert from 'node:assert/strict';
import test from 'node:test';
import { applyLastModifiedStamps } from './computedFields.js';

const now = new Date('2026-10-26T00:00:00.000Z');

test('stamps the timestamp when the watched field changes and keeps it out of the outbox', () => {
  const { mirror, outbox } = applyLastModifiedStamps({ 'Post-Sale Outcome': 'Pending' }, { 'Post-Sale Outcome': 'Sold' }, now);
  assert.equal(mirror['Post-Sale Outcome At'], now.toISOString());
  assert.deepEqual(outbox, { 'Post-Sale Outcome': 'Sold' });
});

test('does not restamp when the watched value is unchanged', () => {
  const { mirror } = applyLastModifiedStamps({ 'Post-Sale Outcome': 'Sold' }, { 'Post-Sale Outcome': 'Sold' }, now);
  assert.equal('Post-Sale Outcome At' in mirror, false);
});

test('keeps an explicitly written timestamp in the mirror but not in the outbox', () => {
  const { mirror, outbox } = applyLastModifiedStamps({}, { 'Post-Sale Outcome': 'Sold', 'Post-Sale Outcome At': '2026-01-01T00:00:00.000Z' }, now);
  assert.equal(mirror['Post-Sale Outcome At'], '2026-01-01T00:00:00.000Z');
  assert.equal('Post-Sale Outcome At' in outbox, false);
});

test('ignores unrelated fields', () => {
  const { mirror, outbox } = applyLastModifiedStamps({}, { Make: 'McIntosh' }, now);
  assert.deepEqual(mirror, { Make: 'McIntosh' });
  assert.deepEqual(outbox, { Make: 'McIntosh' });
});
