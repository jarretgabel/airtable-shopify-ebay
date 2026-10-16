export const DEFAULT_EBAY_NOTIFICATION_TOPICS = [
  'ORDER_CONFIRMATION',
  'ORDER_CANCELLATION_ACTIVITY',
  'ORDER_RETURN_ACTIVITY',
] as const;

export interface EbayNotificationDestinationSummary {
  destinationId: string;
  endpoint: string;
  status: string;
}

export interface EbayNotificationSubscriptionSummary {
  subscriptionId: string;
  topicId: string;
  destinationId: string;
  status: string;
}

export interface EbayNotificationSetupDependencies {
  endpoint: string;
  verificationToken: string;
  topics: string[];
  listDestinations: () => Promise<EbayNotificationDestinationSummary[]>;
  listSubscriptions: () => Promise<EbayNotificationSubscriptionSummary[]>;
  getTopicSchemaVersion: (topicId: string) => Promise<string>;
  createDestination: (input: { name: string; endpoint: string; verificationToken: string }) => Promise<string>;
  createSubscription: (input: { destinationId: string; topicId: string; schemaVersion: string }) => Promise<string>;
}

export interface EbayNotificationSetupAction {
  type: 'destination' | 'subscription';
  target: string;
  state: 'planned' | 'created' | 'exists';
  id?: string;
}

export interface EbayNotificationSetupResult {
  actions: EbayNotificationSetupAction[];
  warnings: string[];
}

const DESTINATION_NAME = 'airtable-shopify-ebay-sales';

function assertSafeConfiguration(dependencies: EbayNotificationSetupDependencies): void {
  let url: URL;
  try {
    url = new URL(dependencies.endpoint);
  } catch {
    throw new Error('eBay notification endpoint must be a valid URL.');
  }

  if (url.protocol !== 'https:' || /^(localhost|127\.|10\.|192\.168\.|0\.0\.0\.0)/i.test(url.hostname)) {
    throw new Error('eBay notification endpoint must be a public HTTPS URL (not localhost or an internal address).');
  }

  if (!/^[A-Za-z0-9_-]{32,80}$/.test(dependencies.verificationToken)) {
    throw new Error('eBay verification token must be 32-80 characters of letters, digits, "_" or "-".');
  }

  if (dependencies.topics.length === 0) {
    throw new Error('At least one eBay notification topic is required.');
  }
}

// Idempotent and additive: existing destinations and subscriptions are reused and never modified or deleted.
export async function runEbayNotificationSetup(
  dependencies: EbayNotificationSetupDependencies,
  options: { apply: boolean },
): Promise<EbayNotificationSetupResult> {
  assertSafeConfiguration(dependencies);

  const actions: EbayNotificationSetupAction[] = [];
  const warnings: string[] = [];
  const completed: string[] = [];

  const fail = (error: unknown): never => {
    const wrapped = Object.assign(error instanceof Error ? error : new Error(String(error)), { completed: [...completed] });
    throw wrapped;
  };

  const existingDestination = (await dependencies.listDestinations()).find((item) => item.endpoint === dependencies.endpoint);
  let destinationId = existingDestination?.destinationId ?? '';

  if (existingDestination) {
    actions.push({ type: 'destination', target: dependencies.endpoint, state: 'exists', id: destinationId });
    if (existingDestination.status !== 'ENABLED') {
      warnings.push(`Destination ${destinationId} is ${existingDestination.status}, not ENABLED. Fix it in eBay before relying on notifications.`);
    }
  } else if (options.apply) {
    try {
      destinationId = await dependencies.createDestination({
        name: DESTINATION_NAME,
        endpoint: dependencies.endpoint,
        verificationToken: dependencies.verificationToken,
      });
    } catch (error) {
      return fail(error);
    }
    completed.push(`destination:${destinationId}`);
    actions.push({ type: 'destination', target: dependencies.endpoint, state: 'created', id: destinationId });
  } else {
    actions.push({ type: 'destination', target: dependencies.endpoint, state: 'planned' });
  }

  const subscriptions = await dependencies.listSubscriptions();

  for (const topicId of dependencies.topics) {
    const existing = destinationId
      ? subscriptions.find((item) => item.topicId === topicId && item.destinationId === destinationId)
      : undefined;

    if (existing) {
      actions.push({ type: 'subscription', target: topicId, state: 'exists', id: existing.subscriptionId });
      if (existing.status !== 'ENABLED') {
        warnings.push(`Subscription ${existing.subscriptionId} for ${topicId} is ${existing.status}, not ENABLED.`);
      }
      continue;
    }

    if (!options.apply) {
      actions.push({ type: 'subscription', target: topicId, state: 'planned' });
      continue;
    }

    try {
      const schemaVersion = await dependencies.getTopicSchemaVersion(topicId);
      const id = await dependencies.createSubscription({ destinationId, topicId, schemaVersion });
      completed.push(`subscription:${topicId}`);
      actions.push({ type: 'subscription', target: topicId, state: 'created', id });
    } catch (error) {
      return fail(error);
    }
  }

  return { actions, warnings };
}
