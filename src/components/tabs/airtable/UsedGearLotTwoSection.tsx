import { useEffect, useMemo, useState } from 'react';
import { EmptySurface } from '@/components/app/StateSurfaces';
import { useCopyQueueLink } from '@/components/tabs/airtable/useCopyQueueLink';
import { displayInventoryValue } from '@/services/inventoryDirectory';
import { groupUsedGearWorkflowRecords, loadLotTwoQueue, loadUsedGearWorkflowRecordBySku } from '@/services/usedGearQueue';
import type { AirtableRecord } from '@/types/airtable';

interface UsedGearLotTwoSectionProps {
  onOpenIncomingGearForm: (recordId: string) => void;
  onOpenTestingForm: (recordId: string) => void;
  onOpenPhotosForm: (recordId: string) => void;
  onOpenWorkflowRecord: (recordId: string) => void;
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
}

function recordSearchText(record: AirtableRecord): string {
  return [
    record.fields.SKU,
    record.fields.Make,
    record.fields.Model,
    record.fields['Workflow Status'],
    record.fields['Submission Group ID'],
    record.fields['Pick Up ID'],
  ]
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
}

export function UsedGearLotTwoSection({
  onOpenIncomingGearForm,
  onOpenTestingForm,
  onOpenPhotosForm,
  onOpenWorkflowRecord,
  searchTerm: controlledSearchTerm,
  onSearchTermChange,
}: UsedGearLotTwoSectionProps) {
  const { copyingLink, copiedLink, copyLink } = useCopyQueueLink({
    sectionId: 'used-gear-lot-two',
    successTitle: 'Parking Lot 2 link copied',
    successMessage: 'The Parking Lot 2 queue link is ready to share.',
    unavailableMessage: 'This browser cannot copy the Parking Lot 2 queue link automatically.',
    failureMessage: 'The Parking Lot 2 queue link could not be copied. Try again or copy the URL from the browser address bar.',
  });
  const [records, setRecords] = useState<AirtableRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uncontrolledSearchTerm, setUncontrolledSearchTerm] = useState('');
  const [activationSku, setActivationSku] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [activatingBySku, setActivatingBySku] = useState(false);
  const searchTerm = typeof controlledSearchTerm === 'string' ? controlledSearchTerm : uncontrolledSearchTerm;

  useEffect(() => {
    let cancelled = false;

    const loadQueue = async () => {
      setLoading(true);
      setError(null);

      try {
        const nextRecords = await loadLotTwoQueue();
        if (!cancelled) {
          setRecords(nextRecords);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load the Parking Lot 2 queue.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadQueue();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return records;
    }

    return records.filter((record) => recordSearchText(record).includes(normalizedSearch));
  }, [records, searchTerm]);

  const groupedRecords = useMemo(() => groupUsedGearWorkflowRecords(filteredRecords), [filteredRecords]);
  const selectedRecord = useMemo(
    () => records.find((record) => record.id === selectedRecordId) ?? null,
    [records, selectedRecordId],
  );

  const refreshQueue = async () => {
    setRefreshing(true);
    setError(null);

    try {
      setRecords(await loadLotTwoQueue());
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh the Parking Lot 2 queue.');
    } finally {
      setRefreshing(false);
    }
  };

  const inputClassName = 'w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';

  const handleSearchTermChange = (value: string) => {
    if (typeof controlledSearchTerm !== 'string') {
      setUncontrolledSearchTerm(value);
    }

    onSearchTermChange?.(value);
  };

  const activateBySku = async (
    action: (recordId: string) => void,
    fallbackRecordId?: string | null,
  ) => {
    const normalizedSku = activationSku.trim();
    if (normalizedSku) {
      setActivatingBySku(true);
      setError(null);

      try {
        const record = await loadUsedGearWorkflowRecordBySku(normalizedSku);
        action(record.id);
      } catch (activationError) {
        setError(activationError instanceof Error ? activationError.message : 'Unable to find the requested SKU in the used-gear workflow.');
      } finally {
        setActivatingBySku(false);
      }
      return;
    }

    if (fallbackRecordId) {
      action(fallbackRecordId);
      return;
    }

    setError('Select a Parking Lot 2 row or enter a SKU before activating downstream workflow forms.');
  };

  return (
    <section id="used-gear-lot-two" className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="m-0 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Used Gear Intake</p>
          <h3 className="mt-2 text-2xl font-semibold text-[var(--ink)]">Parking Lot 2</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Accepted intake rows that are awaiting arrival handling, SKU assignment, or missing-item follow-up. Use this queue to jump directly into Incoming Gear updates or the workflow detail page.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => {
              void copyLink();
            }}
            disabled={copyingLink}
          >
            {copyingLink ? 'Copying...' : copiedLink ? 'Link Copied' : 'Copy Queue Link'}
          </button>
          <label className="min-w-[240px] flex-1">
            <span className="sr-only">Search Parking Lot 2</span>
            <input
              type="text"
              className={inputClassName}
              value={searchTerm}
              onChange={(event) => handleSearchTermChange(event.currentTarget.value)}
              placeholder="Search by SKU, make, model, status, or group id"
            />
          </label>
          <button
            type="button"
            className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => {
              void refreshQueue();
            }}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh Queue'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Downstream Activation</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Activate work by selecting a queue row below or by entering an exact SKU when the queue item is already known.
            </p>
          </div>
          <label className="min-w-[240px] lg:max-w-[280px]">
            <span className="sr-only">Activate by SKU</span>
            <input
              type="text"
              className={inputClassName}
              value={activationSku}
              onChange={(event) => setActivationSku(event.currentTarget.value)}
              placeholder="Exact SKU for direct activation"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => {
              void activateBySku(onOpenIncomingGearForm, selectedRecord?.id);
            }}
            disabled={activatingBySku}
          >
            Open Incoming Gear
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => {
              void activateBySku(onOpenTestingForm, selectedRecord?.id);
            }}
            disabled={activatingBySku}
          >
            Open Testing
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => {
              void activateBySku(onOpenPhotosForm, selectedRecord?.id);
            }}
            disabled={activatingBySku}
          >
            Open Photos
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => {
              void activateBySku(onOpenWorkflowRecord, selectedRecord?.id);
            }}
            disabled={activatingBySku}
          >
            Open Workflow Detail
          </button>
        </div>
        {selectedRecord ? (
          <p className="m-0 mt-3 text-xs text-[var(--muted)]">
            Selected row: <span className="font-semibold text-[var(--ink)]">{displayInventoryValue(selectedRecord.fields.SKU)}</span>
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Lot 2 Rows</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{records.length}</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Visible After Search</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{filteredRecords.length}</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Visible Groups</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{groupedRecords.length}</p>
        </div>
      </div>

      {!loading && records.length === 0 ? (
        <EmptySurface title="Parking Lot 2 is clear" message="No accepted arrival-stage workflow rows are currently waiting in Parking Lot 2.">
          <p className="mt-3 text-sm text-[var(--muted)]">
            Next route: promote accepted intake rows out of Parking Lot 1, or reopen a workflow row by SKU when the item is already known and needs stage work.
          </p>
        </EmptySurface>
      ) : null}

      <div className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-5 text-sm text-[var(--muted)]">
            Loading Parking Lot 2 queue...
          </div>
        ) : groupedRecords.map((group) => (
          <div key={group.id} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/60 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{group.description}</p>
                <h4 className="mt-1 text-lg font-semibold text-[var(--ink)]">{group.label}</h4>
              </div>
              <div className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                {group.records.length} row{group.records.length === 1 ? '' : 's'}
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {group.records.map((record) => (
                <article key={record.id} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{displayInventoryValue(record.fields['Workflow Source'])}</p>
                      <h5 className="mt-1 text-lg font-semibold text-[var(--ink)]">{displayInventoryValue(record.fields.SKU)}</h5>
                      <p className="mt-1 text-sm text-[var(--muted)]">{displayInventoryValue(record.fields.Make)} · {displayInventoryValue(record.fields.Model)}</p>
                    </div>
                    <div className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                      {displayInventoryValue(record.fields['Workflow Status'])}
                    </div>
                  </div>

                  <div className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                    <div>
                      <span className="font-semibold text-[var(--ink)]">Pick Up:</span> {displayInventoryValue(record.fields['Pick Up ID'])}
                    </div>
                    <div>
                      <span className="font-semibold text-[var(--ink)]">Submission Group:</span> {displayInventoryValue(record.fields['Submission Group ID'])}
                    </div>
                    <div>
                      <span className="font-semibold text-[var(--ink)]">Qualification Notes:</span> {displayInventoryValue(record.fields['Qualification Notes'])}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      onClick={() => setSelectedRecordId(record.id)}
                    >
                      {selectedRecordId === record.id ? 'Selected For Activation' : 'Select For Activation'}
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      onClick={() => onOpenWorkflowRecord(record.id)}
                    >
                      Workflow Detail
                    </button>
                    <button
                      type="button"
                      className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
                      onClick={() => onOpenIncomingGearForm(record.id)}
                    >
                      Open Incoming Gear
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}