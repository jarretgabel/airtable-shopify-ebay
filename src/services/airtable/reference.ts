/**
 * Airtable reference parsing — resolves human-readable table references
 * (base/table IDs, view IDs, or short-form slugs) into structured query candidates.
 */

export interface ParsedAirtableReference {
  baseId: string;
  tableName: string;
  viewId?: string;
}

function normalizeId(raw: string, prefix: 'app' | 'tbl' | 'viw'): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  return trimmed.startsWith(prefix) ? trimmed : `${prefix}${trimmed}`;
}

/**
 * Given a reference string (e.g. "appXXXX/viwYYYY" or a full Airtable URL),
 * returns one or more candidate {baseId, tableName, viewId} objects to try in order.
 * The first candidate that succeeds wins; 401/403/404 responses fall through to the next.
 */
export function parseAirtableReferenceCandidates(
  reference: string,
  fallbackTableName: string,
  defaultBaseId: string,
): ParsedAirtableReference[] {
  const trimmed = reference.trim();
  if (!trimmed) {
    throw new Error('Airtable table reference is empty');
  }

  const cleaned = trimmed
    .replace(/^https?:\/\//, '')
    .replace(/^airtable\.com\//, '')
    .replace(/^www\.airtable\.com\//, '')
    .replace(/^\/+/, '');
  const parts = cleaned.split('/').filter(Boolean);

  if (parts.length < 2) {
    throw new Error(
      'Airtable table reference must be in the format "baseId/tableId" or "baseId/viewId"',
    );
  }

  const firstPart  = parts[0];
  const secondPart = parts[1];
  const candidates: ParsedAirtableReference[] = [];
  const fallback   = fallbackTableName?.trim();

  const pushUniqueCandidate = (candidate: ParsedAirtableReference) => {
    if (
      candidates.some(
        (current) =>
          current.baseId    === candidate.baseId &&
          current.tableName === candidate.tableName &&
          current.viewId    === candidate.viewId,
      )
    ) {
      return;
    }
    candidates.push(candidate);
  };

  const secondLooksLikeView = secondPart.startsWith('viw') || !secondPart.startsWith('tbl');

  if (secondLooksLikeView) {
    const viewId = normalizeId(secondPart, 'viw');

    if (firstPart.startsWith('app')) {
      if (!fallback) {
        throw new Error('Airtable table name is required when reference uses a view ID');
      }
      pushUniqueCandidate({
        baseId:    normalizeId(firstPart, 'app'),
        tableName: fallback,
        viewId,
      });
      return candidates;
    }

    // Shorthand refs are ambiguous (base/view vs table/view). Prefer current base first
    // to avoid fail-first 403 requests in the browser console.
    pushUniqueCandidate({
      baseId:    defaultBaseId,
      tableName: normalizeId(firstPart, 'tbl'),
      viewId,
    });

    if (fallback) {
      pushUniqueCandidate({
        baseId:    defaultBaseId,
        tableName: fallback,
        viewId,
      });
    }

    return candidates;
  }

  // Explicit base/table interpretation.
  pushUniqueCandidate({
    baseId:    normalizeId(firstPart, 'app'),
    tableName: normalizeId(secondPart, 'tbl'),
  });

  return candidates;
}
