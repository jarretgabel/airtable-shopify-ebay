import { addInteraction, INTERACTION_KINDS, type InteractionKind } from '../../db/crm.js';
import { badRequest, crmHandler, notFound, requireBody, requireText, requireUuidParam } from './shared.js';

export const handler = crmHandler('add interaction', async (event, pool, user) => {
  const contactId = requireUuidParam(event, 'contactId');
  const body = requireBody(event);
  const kind = String(body.kind ?? 'note') as InteractionKind;
  if (!INTERACTION_KINDS.includes(kind)) throw badRequest('kind is not supported', 'CRM_INVALID_BODY');
  if (!(await addInteraction(pool, contactId, kind, requireText(body.summary, 'summary'), user.email))) throw notFound('Contact');
  return { saved: true };
});
