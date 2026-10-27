import { listContacts } from '../../db/crm.js';
import { readIntegerQueryParam } from '../../shared/http.js';
import { crmHandler } from './shared.js';

export const handler = crmHandler('list contacts', async (event, pool) => ({
  contacts: await listContacts(
    pool,
    event.queryStringParameters?.search ?? '',
    readIntegerQueryParam(event, 'limit', { defaultValue: 50, min: 1, max: 200, service: 'crm', code: 'CRM_LIMIT_INVALID' }),
  ),
}));
