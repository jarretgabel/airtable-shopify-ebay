import { listDueFollowUps } from '../../db/crm.js';
import { crmHandler } from './shared.js';

export const handler = crmHandler('list due follow-ups', async (_event, pool) => ({ followUps: await listDueFollowUps(pool) }));
