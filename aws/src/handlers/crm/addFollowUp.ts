import { addFollowUp } from '../../db/crm.js';
import { badRequest, crmHandler, notFound, requireBody, requireText, requireUuidParam } from './shared.js';

export const handler = crmHandler('add follow-up', async (event, pool, user) => {
  const contactId = requireUuidParam(event, 'contactId');
  const body = requireBody(event);
  const due = new Date(String(body.dueAt ?? ''));
  if (Number.isNaN(due.getTime())) throw badRequest('dueAt must be a valid date', 'CRM_INVALID_BODY');
  if (!(await addFollowUp(pool, contactId, due.toISOString(), requireText(body.note, 'note'), user.email))) throw notFound('Contact');
  return { saved: true };
});
