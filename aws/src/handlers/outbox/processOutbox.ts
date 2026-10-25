import { getPostgresPool } from '../../db/pool.js';
import { airtableListingStore } from '../../store/airtableListingStore.js';
import { getOutboxDepth, runOutbox } from '../../store/outboxWorker.js';

/** Scheduled every minute: replays Postgres-first writes to Airtable and publishes outbox depth metrics. */
export async function handler(): Promise<{ sent: number; retried: number; dead: number }> {
  const pool = getPostgresPool();
  const paused = process.env.AIRTABLE_OUTBOX_SYNC?.trim().toLowerCase() === 'paused';
  const result = await runOutbox({ pool, airtable: airtableListingStore, paused });
  const depth = await getOutboxDepth(pool);

  console.info(JSON.stringify({
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [{
        Namespace: 'AirtableShopifyEbay/DataBackend',
        Dimensions: [[]],
        Metrics: [
          { Name: 'OutboxPending', Unit: 'Count' },
          { Name: 'OutboxDead', Unit: 'Count' },
          { Name: 'OutboxOldestPendingSeconds', Unit: 'Seconds' },
        ],
      }],
    },
    OutboxPending: depth.pending,
    OutboxDead: depth.dead,
    OutboxOldestPendingSeconds: depth.oldestPendingSeconds,
    AirtableOutboxPaused: paused,
    ...result,
  }));
  return result;
}
