import { HttpError } from '../../shared/errors.js';
import { getOptionalSecret, requireSecret } from '../../shared/secrets.js';

export interface AirtableListingsRequest {
  tableName: string;
  view?: string;
}

export function validateListingsRequest(input: AirtableListingsRequest): AirtableListingsRequest {
  const tableName = input.tableName.trim();
  const requestedView = input.view?.trim() || undefined;
  const allowedTableName = requireSecret('ALLOWED_AIRTABLE_TABLE_NAME');
  const allowedView = getOptionalSecret('ALLOWED_AIRTABLE_VIEW_ID');

  if (tableName !== allowedTableName) {
    throw new HttpError(400, 'Unsupported tableName', {
      service: 'airtable',
      code: 'AIRTABLE_TABLE_NOT_ALLOWED',
      retryable: false,
    });
  }

  if (requestedView && allowedView && requestedView !== allowedView) {
    throw new HttpError(400, 'Unsupported view', {
      service: 'airtable',
      code: 'AIRTABLE_VIEW_NOT_ALLOWED',
      retryable: false,
    });
  }

  if (requestedView && !allowedView) {
    throw new HttpError(400, 'Unsupported view', {
      service: 'airtable',
      code: 'AIRTABLE_VIEW_NOT_ALLOWED',
      retryable: false,
    });
  }

  return {
    tableName,
    view: requestedView ?? allowedView,
  };
}