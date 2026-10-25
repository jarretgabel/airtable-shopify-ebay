import assert from 'node:assert/strict';
import test from 'node:test';
import { validateFieldValues, type FieldMeta } from './fieldValidation.js';

const meta = new Map<string, FieldMeta>([
  ['Status', { type: 'singleSelect', options: { choices: [{ name: 'New' }, { name: 'Done' }] } }],
  ['Tags', { type: 'multipleSelects', options: { choices: [{ name: 'a' }, { name: 'b' }] } }],
  ['Price', { type: 'currency' }],
  ['Active', { type: 'checkbox' }],
  ['Day', { type: 'date' }],
  ['When', { type: 'dateTime' }],
  ['Note', { type: 'multilineText' }],
]);

test('accepts valid values, clears and unknown-typed fields', () => {
  assert.deepEqual(validateFieldValues(meta, {
    Status: 'New', Tags: ['a', 'b'], Price: 12.5, Active: false, Day: '2026-10-24', When: '2026-10-24T10:00:00.000Z', Note: 5, Status2: 'x',
  }, {}, false), []);
  assert.deepEqual(validateFieldValues(meta, { Status: null, Tags: null, Price: null }, {}, false), []);
});

test('rejects bad options and types, naming every field', () => {
  const issues = validateFieldValues(meta, {
    Status: 'Nope', Tags: ['a', 'z'], Price: '12', Active: 'yes', Day: '10/24/2026', When: 'soon',
  }, {}, false);
  assert.deepEqual(issues.map((issue) => issue.field), ['Status', 'Tags', 'Price', 'Active', 'Day', 'When']);
  assert.match(issues[0].message, /"Nope" is not an option/);
});

test('skips unchanged values and typecast writes', () => {
  assert.deepEqual(validateFieldValues(meta, { Status: 'Legacy' }, { Status: 'Legacy' }, false), []);
  assert.deepEqual(validateFieldValues(meta, { Status: 'Brand new', Price: '12' }, {}, true), []);
});
