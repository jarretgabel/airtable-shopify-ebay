import { useEffect, useMemo, useState } from 'react';
import { smallPrimaryActionButtonClass, smallSecondaryActionButtonClass, smallSuccessActionButtonClass } from '@/components/app/buttonStyles';
import { CollapsibleHelperText } from '@/components/app/CollapsibleHelperText';
import { CopyLinkIconButton } from '@/components/app/CopyLinkIconButton';
import { EmptySurface } from '@/components/app/StateSurfaces';
import { RefreshIconButton } from '@/components/app/RefreshIconButton';
import { ToolbarIconButton } from '@/components/app/ToolbarIconButton';
import { useCopyQueueLink } from '@/components/tabs/airtable/useCopyQueueLink';
import { displayInventoryValue } from '@/services/inventoryDirectory';
import { groupUsedGearWorkflowRecords, loadLotTwoQueue, loadUsedGearWorkflowRecordBySku } from '@/services/usedGearQueue';
import type { AirtableRecord } from '@/types/airtable';

interface UsedGearLotTwoSectionProps {
  onOpenIncomingGearForm: (recordId: string) => void;
  onOpenTestingForm: (recordId: string) => void;
  onOpenPhotosForm: (recordId: string) => void;
  onOpenWorkflowRecord: (recordId: string) => void;
  showSectionIntro?: boolean;
  focusedGroupId?: string | null;
  onFocusedGroupIdChange?: (groupId: string | null) => void;
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

function buildWorkflowLotTwoGroupLink(groupId: string): string {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('workflowLotTwoGroup', groupId);
  nextUrl.hash = 'used-gear-lot-two';
  return nextUrl.toString();
}

const intakeDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

function getRecordIntakeTimestamp(record: AirtableRecord): number {
  const arrivalDate = typeof record.fields['Arrival Date'] === 'string' ? record.fields['Arrival Date'].trim() : '';
  const parsedArrival = arrivalDate ? Date.parse(arrivalDate) : Number.NaN;
  if (Number.isFinite(parsedArrival)) {
    return parsedArrival;
  }

  const createdTime = Date.parse(record.createdTime);
  return Number.isFinite(createdTime) ? createdTime : Number.POSITIVE_INFINITY;
}

function formatIntakeDate(record: AirtableRecord): string {
  const intakeTimestamp = getRecordIntakeTimestamp(record);
  if (Number.isFinite(intakeTimestamp)) {
    return intakeDateFormatter.format(new Date(intakeTimestamp));
  }

  return 'Unknown';
}

function formatGroupIntakeDate(records: AirtableRecord[]): string {
  const earliestTimestamp = Math.min(...records.map(getRecordIntakeTimestamp));
  if (Number.isFinite(earliestTimestamp)) {
    return intakeDateFormatter.format(new Date(earliestTimestamp));
  }

  return 'Unknown';
}

function getGroupHeading(description: string): string {
  if (description === 'Single record') {
    return 'Single intake item';
  }
  if (description === 'Pickup group') {
    return 'Pickup set';
  }
  if (description === 'Submission group') {
    return 'Submission set';
  }
  return description;
}

export function UsedGearLotTwoSection({
  onOpenIncomingGearForm,
  onOpenTestingForm,
  onOpenPhotosForm,
  onOpenWorkflowRecord,
  showSectionIntro = true,
  focusedGroupId = null,
  onFocusedGroupIdChange,
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
  const visibleGroups = useMemo(
    () => (focusedGroupId ? groupedRecords.filter((group) => group.id === focusedGroupId) : groupedRecords),
    [focusedGroupId, groupedRecords],
  );
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
      <div className="flex flex-col gap-4">
        {showSectionIntro ? (
          <div>
            <p className="m-0 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Used Gear Intake</p>
            <h3 className="mt-2 text-2xl font-semibold text-[var(--ink)]">Parking Lot 2</h3>
            <div className="mt-3 max-w-2xl">
              <CollapsibleHelperText label="Queue guide">
                Work accepted intake rows that still need arrival handling, SKU assignment, or missing-item follow-up.
              </CollapsibleHelperText>
            </div>
          </div>
        ) : null}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
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
          <div className="flex flex-wrap gap-3">
            <CopyLinkIconButton
              onClick={() => {
                void copyLink();
              }}
              disabled={copyingLink}
              copying={copyingLink}
              copied={copiedLink}
              label="Copy Queue Link"
              copyingLabel="Copying queue link"
              copiedLabel="Queue link copied"
            />
            <RefreshIconButton
              onClick={() => {
                void refreshQueue();
              }}
              disabled={refreshing}
              loading={refreshing}
              label="Refresh Parking Lot 2 queue"
              loadingLabel="Refreshing Parking Lot 2 queue"
            />
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
        </div>
      ) : null}

      {focusedGroupId ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
          <span>Focused on one Parking Lot 2 set from a shared workflow link.</span>
          {onFocusedGroupIdChange ? (
            <button
              type="button"
              className={smallSecondaryActionButtonClass}
              onClick={() => onFocusedGroupIdChange(null)}
            >
              Clear Focus
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Downstream Activation</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Select a queue row below or enter an exact SKU when you already know which workflow item should open next.
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
            className={smallSuccessActionButtonClass}
            onClick={() => {
              void activateBySku(onOpenIncomingGearForm, selectedRecord?.id);
            }}
            disabled={activatingBySku}
          >
            Open Incoming Gear
          </button>
          <button
            type="button"
            className={smallSecondaryActionButtonClass}
            onClick={() => {
              void activateBySku(onOpenTestingForm, selectedRecord?.id);
            }}
            disabled={activatingBySku}
          >
            Open Testing
          </button>
          <button
            type="button"
            className={smallSecondaryActionButtonClass}
            onClick={() => {
              void activateBySku(onOpenPhotosForm, selectedRecord?.id);
            }}
            disabled={activatingBySku}
          >
            Open Photos
          </button>
          <button
            type="button"
            className={smallSecondaryActionButtonClass}
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
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Visible Sets</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{visibleGroups.length}</p>
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
        ) : visibleGroups.map((group) => (
          <div key={group.id} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/60 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{getGroupHeading(group.description)}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">Earliest intake {formatGroupIntakeDate(group.records)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {onFocusedGroupIdChange ? (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--bg)] px-1.5 py-1">
                    <ToolbarIconButton
                      onClick={() => onFocusedGroupIdChange(group.id)}
                      label={group.description === 'Single record'
                        ? (focusedGroupId === group.id ? 'Focused Item' : 'Focus Item')
                        : (focusedGroupId === group.id ? 'Focused Set' : 'Focus Set')}
                      className="h-7 w-7 rounded-full border-transparent bg-transparent shadow-none hover:bg-[var(--line)]"
                      icon={(
                        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
                          <circle cx="10" cy="10" r="4.25" stroke="currentColor" strokeWidth="1.75" />
                          <path d="M10 2.917v2.5M10 14.583v2.5M17.083 10h-2.5M5.417 10h-2.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                        </svg>
                      )}
                    />
                    <CopyLinkIconButton
                      onClick={() => {
                        void copyLink(buildWorkflowLotTwoGroupLink(group.id));
                      }}
                      disabled={copyingLink}
                      copying={copyingLink}
                      copied={copiedLink}
                      label={group.description === 'Single record' ? 'Copy Item Link' : 'Copy Group Link'}
                      copyingLabel={group.description === 'Single record' ? 'Copying item link' : 'Copying group link'}
                      copiedLabel={group.description === 'Single record' ? 'Item link copied' : 'Group link copied'}
                      className="h-7 w-7 rounded-full border-transparent bg-transparent shadow-none hover:bg-[var(--line)]"
                    />
                  </div>
                ) : null}
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
                      <span className="font-semibold text-[var(--ink)]">Intake Date:</span> {formatIntakeDate(record)}
                    </div>
                    <div>
                      <span className="font-semibold text-[var(--ink)]">Qualification Notes:</span> {displayInventoryValue(record.fields['Qualification Notes'])}
                    </div>
                    <div>
                      <span className="font-semibold text-[var(--ink)]">Offer Amount:</span> {displayInventoryValue(record.fields['Offer Amount'])}
                    </div>
                    <div>
                      <span className="font-semibold text-[var(--ink)]">Paid Amount:</span> {displayInventoryValue(record.fields['Paid Amount'])}
                    </div>
                    <div>
                      <span className="font-semibold text-[var(--ink)]">Accepted At:</span> {displayInventoryValue(record.fields['Accepted At'])}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={selectedRecordId === record.id ? smallSuccessActionButtonClass : smallSecondaryActionButtonClass}
                      onClick={() => setSelectedRecordId(record.id)}
                    >
                      {selectedRecordId === record.id ? 'Selected' : 'Select Row'}
                    </button>
                    <button
                      type="button"
                      className={smallSecondaryActionButtonClass}
                      onClick={() => onOpenWorkflowRecord(record.id)}
                    >
                      Workflow Detail
                    </button>
                    <button
                      type="button"
                      className={smallPrimaryActionButtonClass}
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