import { useState } from 'react';
import { getRecordHistory, type RecordHistoryEntry } from '@/services/app-api/dashboard';
import { useAuthStore } from '@/stores/auth/authStore';
import { hasFullAccessRole } from '@/auth/roleAccess';
import { detailDisclosureBodyClass, detailDisclosureClass, detailDisclosureSummaryClass } from '@/components/tabs/uiClasses';

const MAX_VALUE_LENGTH = 120;

function formatValue(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const compact = (text ?? '').replace(/\s+/g, ' ').trim();
  return compact.length > MAX_VALUE_LENGTH ? `${compact.slice(0, MAX_VALUE_LENGTH)}…` : compact || '(empty)';
}

export function ListingEditHistory({ recordId }: { recordId: string }) {
  const canView = useAuthStore((state) => {
    const currentUser = state.users.find((user) => user.id === state.currentUserId);
    return currentUser ? hasFullAccessRole(currentUser.role) : false;
  });
  const [entries, setEntries] = useState<RecordHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canView) return null;

  const load = () => {
    if (entries) return;
    getRecordHistory('approval-combined', recordId)
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load edit history.'));
  };

  return (
    <details className={detailDisclosureClass} onToggle={(event) => { if (event.currentTarget.open) load(); }}>
      <summary className={detailDisclosureSummaryClass}>Edit history</summary>
      <div className={detailDisclosureBodyClass}>
        {error ? <p role="alert">{error}</p> : null}
        {!error && !entries ? <p>Loading history…</p> : null}
        {entries && entries.length === 0 ? <p>No edits recorded yet.</p> : null}
        {entries?.map((entry) => (
          <div key={entry.id} className="border-b border-[var(--line)] py-2 last:border-b-0">
            <p className="text-xs font-semibold">{new Date(entry.at).toLocaleString()} · {entry.op}</p>
            <ul className="mt-1 space-y-0.5 text-xs">
              {Object.entries(entry.fields).map(([name, value]) => (
                <li key={name}><span className="font-medium">{name}:</span> {formatValue(value)}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
