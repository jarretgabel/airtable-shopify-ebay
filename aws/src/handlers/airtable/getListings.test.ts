import assert from 'node:assert/strict';
import test from 'node:test';
import { storeSourceForTable } from './getListings.js';

test('legacy listings read is served by the store only when a source on that table is off Airtable', () => {
  const saved = { ...process.env };
  try {
    process.env.AIRTABLE_BASE_ID = 'appTEST';
    process.env.AIRTABLE_TABLE_NAME = 'tblgA8olAJtkRNZvK';
    process.env.AIRTABLE_COMBINED_LISTINGS_TABLE_NAME = 'tblgA8olAJtkRNZvK';
    process.env.DATA_BACKEND_OVERRIDES = 'inventory-directory=airtable,approval-ebay=airtable';
    assert.equal(storeSourceForTable('tblgA8olAJtkRNZvK'), undefined);
    process.env.DATA_BACKEND_OVERRIDES = 'inventory-directory=postgres,approval-ebay=airtable';
    assert.equal(storeSourceForTable('tblgA8olAJtkRNZvK'), 'inventory-directory');
    assert.equal(storeSourceForTable('tblOther'), undefined);
  } finally {
    process.env = saved;
  }
});
