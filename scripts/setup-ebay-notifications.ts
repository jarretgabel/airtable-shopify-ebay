import dotenv from 'dotenv';
import {
  createNotificationDestination,
  createNotificationSubscription,
  getNotificationTopicSchemaVersion,
  listNotificationDestinations,
  listNotificationSubscriptions,
  probeNotificationAccess,
} from '../aws/src/providers/ebay/client.js';
import {
  DEFAULT_EBAY_NOTIFICATION_TOPICS,
  runEbayNotificationSetup,
} from '../aws/src/services/ebayNotificationSetup.js';
import { buildEbayNotificationEndpoint } from '../aws/src/services/ebayNotifications.js';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

for (const name of ['CLIENT_ID', 'CLIENT_SECRET', 'REFRESH_TOKEN', 'ENV', 'WEBHOOK_BASE_URL', 'NOTIFICATION_VERIFICATION_TOKEN', 'NOTIFICATION_TOPICS']) {
  process.env[`EBAY_${name}`] = process.env[`EBAY_${name}`] || process.env[`VITE_EBAY_${name}`] || '';
}

// Usage: npm run ebay:notifications:setup [-- --check-access | --apply]
// With no flag this is a dry run that only reads. --apply is the only mode that writes to eBay.
async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));

  if (args.has('--check-access')) {
    console.log(JSON.stringify(await probeNotificationAccess(), null, 2));
    return;
  }

  const topics = process.env.EBAY_NOTIFICATION_TOPICS.split(',').map((value) => value.trim()).filter(Boolean);
  const apply = args.has('--apply');

  const result = await runEbayNotificationSetup({
    endpoint: buildEbayNotificationEndpoint(process.env.EBAY_WEBHOOK_BASE_URL),
    verificationToken: process.env.EBAY_NOTIFICATION_VERIFICATION_TOKEN.trim(),
    topics: topics.length > 0 ? topics : [...DEFAULT_EBAY_NOTIFICATION_TOPICS],
    listDestinations: listNotificationDestinations,
    listSubscriptions: listNotificationSubscriptions,
    getTopicSchemaVersion: getNotificationTopicSchemaVersion,
    createDestination: createNotificationDestination,
    createSubscription: createNotificationSubscription,
  }, { apply });

  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', ...result }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  const completed = (error as { completed?: string[] }).completed;
  if (completed?.length) {
    console.error(`Already created before the failure (safe to re-run): ${completed.join(', ')}`);
  }
  process.exitCode = 1;
});
