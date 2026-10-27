import { closeFollowUp } from '../../db/crm.js';
import { badRequest, crmHandler, notFound, requireBody, requireUuidParam } from './shared.js';

export const handler = crmHandler('close follow-up', async (event, pool) => {
  const followUpId = requireUuidParam(event, 'followUpId');
  const status = requireBody(event).status;
  if (status !== 'done' && status !== 'cancelled') throw badRequest('status must be done or cancelled', 'CRM_INVALID_BODY');
  if (!(await closeFollowUp(pool, followUpId, status))) throw notFound('Open follow-up');
  return { saved: true };
});
