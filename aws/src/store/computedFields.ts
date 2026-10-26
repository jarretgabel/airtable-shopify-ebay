// Airtable "last modified time" fields watch one field and restamp when it changes. Postgres does not, so the
// store restamps them here. Airtable rejects writes to them, so they stay out of the outbox payload.
export const LAST_MODIFIED_STAMPS: Record<string, string> = {
  'Post-Sale Outcome': 'Post-Sale Outcome At',
  'Shipment Follow-Through Notes': 'Shipment Follow-Through Updated At',
};

const comparable = (value: unknown): string => JSON.stringify(value ?? null);

export function applyLastModifiedStamps(
  current: Record<string, unknown>,
  writable: Record<string, unknown>,
  now: Date = new Date(),
): { mirror: Record<string, unknown>; outbox: Record<string, unknown> } {
  const mirror = { ...writable };
  const outbox = { ...writable };
  for (const [watched, stamp] of Object.entries(LAST_MODIFIED_STAMPS)) {
    delete outbox[stamp];
    if (!(watched in writable) || stamp in writable) continue;
    if (comparable(current[watched]) !== comparable(writable[watched])) mirror[stamp] = now.toISOString();
  }
  return { mirror, outbox };
}
