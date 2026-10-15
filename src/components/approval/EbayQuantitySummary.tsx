import { warningInlineBannerClass } from '@/components/tabs/uiClasses';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readQuantity(payload: unknown, path: string[]): number | undefined {
  let value = payload;
  for (const key of path) {
    if (!isRecord(value)) return undefined;
    value = value[key];
  }
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}

export function EbayQuantitySummary({ payload }: { payload: unknown }) {
  const inventoryQuantity = readQuantity(payload, ['inventoryItem', 'availability', 'shipToLocationAvailability', 'quantity']);
  const offerQuantity = readQuantity(payload, ['offer', 'availableQuantity']);
  const verified = inventoryQuantity !== undefined && offerQuantity !== undefined && inventoryQuantity === offerQuantity;

  if (payload == null) {
    return <p className={warningInlineBannerClass} role="status">Quantity preview is not available yet.</p>;
  }
  if (verified && inventoryQuantity > 0) return null;

  return (
    <p className={warningInlineBannerClass} role="alert">
      {verified ? (
        'Zero available. Publishing requires a positive quantity; zero has not been replaced with 1.'
      ) : (
        <>
          Unable to verify the eBay quantity preview. Inventory: {inventoryQuantity ?? 'Unavailable'}; offer: {offerQuantity ?? 'Unavailable'}.
          {' '}Both must be matching, nonnegative whole numbers.
        </>
      )}
    </p>
  );
}
