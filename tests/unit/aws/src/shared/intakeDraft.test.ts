import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIntakeDraft } from '../../../../../aws/src/shared/contracts/intakeDraft.js';

const options = { 'Component Type': ['Amplifier', 'DAC'], 'Original Box': ['Yes', 'No'] };

test('reports missing required fields and cleans values', () => {
  const result = normalizeIntakeDraft({ make: ' McIntosh ', model: 'MC275', cost: '$1,500', unknown: 'x' }, options);
  assert.deepEqual(result.values, { make: 'McIntosh', model: 'MC275', cost: '1500' });
  assert.deepEqual(result.missing, ['Pick Up ID', 'Component Type']);
});

test('matches select values case-insensitively and rejects unknown options', () => {
  const ok = normalizeIntakeDraft({ componentType: 'amplifier' }, options);
  assert.equal(ok.values.componentType, 'Amplifier');
  const bad = normalizeIntakeDraft({ componentType: 'Toaster' }, options);
  assert.equal(bad.values.componentType, undefined);
  assert.deepEqual(bad.invalid[0].allowedOptions, ['Amplifier', 'DAC']);
});

test('rejects select values when options are unavailable, bad costs and bad emails', () => {
  assert.equal(normalizeIntakeDraft({ componentType: 'DAC' }, null).invalid.length, 1);
  assert.equal(normalizeIntakeDraft({ cost: 'lots' }, options).invalid[0].field, 'Cost');
  assert.equal(normalizeIntakeDraft({ sellerEmail: 'nope' }, options).invalid[0].field, 'Seller Email');
});

test('ignores non-object input', () => {
  assert.deepEqual(normalizeIntakeDraft('x', options).values, {});
});

import { normalizeDraft, PHOTOS_DRAFT_FIELDS, TESTING_DRAFT_FIELDS } from '../../../../../aws/src/shared/contracts/intakeDraft.js';

test('testing drafts validate minutes and dates and never require fields', () => {
  const ok = normalizeDraft(TESTING_DRAFT_FIELDS, { testingNotes: 'Works', testingTimeMinutes: '45', testingDate: '2026-11-04' }, options);
  assert.deepEqual(ok.values, { testingNotes: 'Works', testingTimeMinutes: '45', testingDate: '2026-11-04' });
  assert.deepEqual(ok.missing, []);
  const bad = normalizeDraft(TESTING_DRAFT_FIELDS, { testingTimeMinutes: 'soon', testingDate: '11/04/2026' }, options);
  assert.deepEqual(bad.invalid.map((issue) => issue.field), ['Testing Time (minutes)', 'Testing Date']);
});

test('photos drafts ignore testing-only fields', () => {
  const result = normalizeDraft(PHOTOS_DRAFT_FIELDS, { photoDate: '2026-11-04', testingNotes: 'x', serialNumber: '1' }, options);
  assert.deepEqual(result.values, { photoDate: '2026-11-04' });
});
