import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpError } from '../../shared/errors.js';
import { validateListingsRequest } from './validation.js';

function withEnv(overrides: Record<string, string | undefined>, run: () => void): void {
  const previousValues = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(overrides)) {
    previousValues.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    run();
  } finally {
    for (const [key, value] of previousValues.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test('validateListingsRequest trims input and applies allowed view when omitted', () => {
  withEnv(
    {
      ALLOWED_AIRTABLE_TABLE_NAME: 'tblAllowed',
      ALLOWED_AIRTABLE_VIEW_ID: 'viwAllowed',
    },
    () => {
      const result = validateListingsRequest({
        tableName: '  tblAllowed  ',
      });

      assert.deepEqual(result, {
        tableName: 'tblAllowed',
        view: 'viwAllowed',
      });
    },
  );
});

test('validateListingsRequest rejects unsupported table names', () => {
  withEnv(
    {
      ALLOWED_AIRTABLE_TABLE_NAME: 'tblAllowed',
      ALLOWED_AIRTABLE_VIEW_ID: 'viwAllowed',
    },
    () => {
      assert.throws(
        () => validateListingsRequest({ tableName: 'tblOther' }),
        (error: unknown) => {
          assert.ok(error instanceof HttpError);
          assert.equal(error.statusCode, 400);
          assert.equal(error.code, 'AIRTABLE_TABLE_NOT_ALLOWED');
          return true;
        },
      );
    },
  );
});

test('validateListingsRequest rejects explicit unsupported view ids', () => {
  withEnv(
    {
      ALLOWED_AIRTABLE_TABLE_NAME: 'tblAllowed',
      ALLOWED_AIRTABLE_VIEW_ID: 'viwAllowed',
    },
    () => {
      assert.throws(
        () => validateListingsRequest({ tableName: 'tblAllowed', view: 'viwOther' }),
        (error: unknown) => {
          assert.ok(error instanceof HttpError);
          assert.equal(error.statusCode, 400);
          assert.equal(error.code, 'AIRTABLE_VIEW_NOT_ALLOWED');
          return true;
        },
      );
    },
  );
});