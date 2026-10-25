import assert from 'node:assert/strict';
import test from 'node:test';
import { compareWithAirtable } from './compareAirtable.js';

test('reports identical, differing, missing and pending records', () => {
  const result = compareWithAirtable(
    [
      { key: 'r1', fields: { A: 1, B: ['x', 'y'], Files: [{ url: 'a' }] } },
      { key: 'r2', fields: { A: 2 } },
      { key: 'r3', fields: { A: 3 } },
      { key: 'r4', fields: { A: 9 } },
      { key: 'rLocal', fields: { A: 5 } },
    ],
    [
      { id: 'r1', fields: { B: ['x', 'y'], A: 1, Files: [{ url: 'b' }] } },
      { id: 'r2', fields: { A: 20 } },
      { id: 'r4', fields: { A: 1 } },
      { id: 'r5', fields: { A: 5 } },
    ],
    { pendingKeys: new Set(['r4']), ignoreFields: new Set(['Files']) },
  );
  assert.equal(result.identical, 1);
  assert.equal(result.differing, 1);
  assert.equal(result.skippedPending, 1);
  assert.deepEqual(result.onlyInPostgres.sort(), ['r3', 'rLocal']);
  assert.deepEqual(result.onlyInAirtable, ['r5']);
  assert.deepEqual(result.differences[0], { field: 'A', count: 1, example: { record: 'r2', postgres: 2, airtable: 20 } });
});
