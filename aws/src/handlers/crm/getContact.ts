import { getContactDetail } from '../../db/crm.js';
import { crmHandler, notFound, requireUuidParam } from './shared.js';

export const handler = crmHandler('load contact', async (event, pool) => {
  const detail = await getContactDetail(pool, requireUuidParam(event, 'contactId'));
  if (!detail) throw notFound('Contact');
  return detail;
});
