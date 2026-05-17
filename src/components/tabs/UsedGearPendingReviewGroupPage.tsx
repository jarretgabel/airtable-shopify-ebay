import { useEffect, useMemo, useState } from 'react';
import { CompactIconActionButton } from '@/components/app/CompactIconActionButton';
import { IntakeItemsMatrix, type IntakeItemsMatrixColumn } from '@/components/app/IntakeItemsMatrix';
import { smallPrimaryActionButtonClass, smallSecondaryActionButtonClass } from '@/components/app/buttonStyles';
import { ErrorSurface, LoadingSurface, PanelSurface } from '@/components/app/StateSurfaces';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import {
  acceptPendingReviewGroup,
  distributeUsedGearPendingReviewTotal,
  loadPendingReviewGroup,
  savePendingReviewGroupReview,
  type UsedGearPendingReviewAcceptedStatus,
  type UsedGearPendingReviewAllocationMode,
  type UsedGearWorkflowGroup,
} from '@/services/usedGearQueue';
import { displayInventoryValue } from '@/services/inventoryDirectory';
import type { AirtableRecord } from '@/types/airtable';

interface UsedGearPendingReviewGroupPageProps {
  currentUserName: string;
  groupId: string;
  onBackToParkingLot: () => void;
  onOpenManualIntake: (recordId: string) => void;
  onOpenOperationalRecord: (recordId: string) => void;
}

interface GroupReviewRecordEditor {
  acceptedStatus: UsedGearPendingReviewAcceptedStatus;
  qualificationNotes: string;
  offerAmount: string;
  paidAmount: string;
}

const ACCEPT_ROUTE_OPTIONS: Array<{
  value: UsedGearPendingReviewAcceptedStatus;
  label: string;
}> = [
  { value: 'Accepted - Awaiting Arrival', label: 'Awaiting Arrival' },
  { value: 'Accepted - Arrived, Awaiting SKU', label: 'Arrived, Awaiting SKU' },
  { value: 'Accepted - Arrived, Awaiting Missing Item', label: 'Arrived, Awaiting Missing Item' },
];

function stringFieldValue(record: AirtableRecord, fieldName: string): string {
  const value = record.fields[fieldName];
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return '';
}

function parseCurrency(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function arrivalTimestamp(record: AirtableRecord): number {
  const parsed = Date.parse(stringFieldValue(record, 'Arrival Date'));
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function sortGroupRecords(records: AirtableRecord[]): AirtableRecord[] {
  return [...records].sort((left, right) => {
    const arrivalDifference = arrivalTimestamp(left) - arrivalTimestamp(right);
    if (arrivalDifference !== 0) {
      return arrivalDifference;
    }

    const makeDifference = stringFieldValue(left, 'Make').localeCompare(stringFieldValue(right, 'Make'));
    if (makeDifference !== 0) {
      return makeDifference;
    }

    return stringFieldValue(left, 'Model').localeCompare(stringFieldValue(right, 'Model'));
  });
}

function acceptedStatusForRecord(record: AirtableRecord): UsedGearPendingReviewAcceptedStatus {
  const value = stringFieldValue(record, 'Workflow Status');
  return value === 'Accepted - Arrived, Awaiting SKU' || value === 'Accepted - Arrived, Awaiting Missing Item'
    ? value
    : 'Accepted - Awaiting Arrival';
}

function buildRecordEditors(records: AirtableRecord[]): Record<string, GroupReviewRecordEditor> {
  return Object.fromEntries(records.map((record) => [
    record.id,
    {
      acceptedStatus: acceptedStatusForRecord(record),
      qualificationNotes: stringFieldValue(record, 'Qualification Notes'),
      offerAmount: stringFieldValue(record, 'Offer Amount'),
      paidAmount: stringFieldValue(record, 'Paid Amount'),
    },
  ]));
}

export function UsedGearPendingReviewGroupPage({
  currentUserName,
  groupId,
  onBackToParkingLot,
  onOpenManualIntake,
  onOpenOperationalRecord,
}: UsedGearPendingReviewGroupPageProps) {
  const [group, setGroup] = useState<UsedGearWorkflowGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submissionGroupId, setSubmissionGroupId] = useState('');
  const [confirmedGrandTotal, setConfirmedGrandTotal] = useState('');
  const [allocationMode, setAllocationMode] = useState<UsedGearPendingReviewAllocationMode>('Equal Split');
  const [allocationNotes, setAllocationNotes] = useState('');
  const [recordEditors, setRecordEditors] = useState<Record<string, GroupReviewRecordEditor>>({});

  useEffect(() => {
    let cancelled = false;

    const loadGroup = async () => {
      setLoading(true);
      setError(null);

      try {
        const nextGroup = await loadPendingReviewGroup(groupId);
        if (!cancelled) {
          const sortedRecords = sortGroupRecords(nextGroup.records);
          setGroup({ ...nextGroup, records: sortedRecords });
          setSubmissionGroupId(stringFieldValue(sortedRecords[0]!, 'Submission Group ID'));
          setConfirmedGrandTotal(stringFieldValue(sortedRecords[0]!, 'Confirmed Grand Total'));
          setAllocationMode((stringFieldValue(sortedRecords[0]!, 'Allocation Mode') as UsedGearPendingReviewAllocationMode) || 'Equal Split');
          setAllocationNotes(stringFieldValue(sortedRecords[0]!, 'Allocation Notes'));
          setRecordEditors(buildRecordEditors(sortedRecords));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load the selected parking-lot review group.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadGroup();

    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const records = useMemo(() => group?.records ?? [], [group]);
  const parsedGrandTotal = parseCurrency(confirmedGrandTotal);
  const groupNeedsSubmissionId = records.length > 1 && submissionGroupId.trim().length === 0;
  const recordColumns = useMemo<IntakeItemsMatrixColumn<AirtableRecord>[]>(() => [
    {
      key: 'sku',
      label: 'SKU',
      width: '9rem',
      renderCell: (record) => <span className="font-semibold text-[var(--ink)]">{displayInventoryValue(record.fields.SKU)}</span>,
    },
    {
      key: 'item',
      label: 'Item',
      width: 'minmax(0,1.3fr)',
      renderCell: (record) => (
        <div className="min-w-0">
          <div className="truncate text-sm text-[var(--ink)]">{displayInventoryValue(record.fields.Make)} · {displayInventoryValue(record.fields.Model)}</div>
          <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
            <span>{displayInventoryValue(record.fields['Workflow Source'])}</span>
            <span>{displayInventoryValue(record.fields['Arrival Date'])}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'route',
      label: 'Route',
      width: '11rem',
      renderCell: (record) => {
        const editor = recordEditors[record.id];

        return (
          <select
            aria-label="Lot 2 Route"
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-2.5 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            value={editor?.acceptedStatus ?? 'Accepted - Awaiting Arrival'}
            onChange={(event) => {
              const nextValue = event.currentTarget.value as UsedGearPendingReviewAcceptedStatus;
              setRecordEditors((currentEditors) => ({
                ...currentEditors,
                [record.id]: {
                  ...currentEditors[record.id],
                  acceptedStatus: nextValue,
                },
              }));
            }}
          >
            {ACCEPT_ROUTE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        );
      },
    },
    {
      key: 'offer',
      label: 'Offer',
      width: '8rem',
      renderCell: (record) => {
        const editor = recordEditors[record.id];

        return (
          <input
            aria-label="Offer Amount"
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-2.5 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            type="number"
            step="0.01"
            value={editor?.offerAmount ?? ''}
            onChange={(event) => {
              const nextValue = event.currentTarget.value;
              setRecordEditors((currentEditors) => ({
                ...currentEditors,
                [record.id]: {
                  ...currentEditors[record.id],
                  offerAmount: nextValue,
                },
              }));
            }}
          />
        );
      },
    },
    {
      key: 'paid',
      label: 'Paid',
      width: '8rem',
      renderCell: (record) => {
        const editor = recordEditors[record.id];

        return (
          <input
            aria-label="Paid Amount"
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-2.5 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            type="number"
            step="0.01"
            value={editor?.paidAmount ?? ''}
            onChange={(event) => {
              const nextValue = event.currentTarget.value;
              setRecordEditors((currentEditors) => ({
                ...currentEditors,
                [record.id]: {
                  ...currentEditors[record.id],
                  paidAmount: nextValue,
                },
              }));
            }}
          />
        );
      },
    },
    {
      key: 'notes',
      label: 'Notes',
      width: 'minmax(0,1.45fr)',
      renderCell: (record) => {
        const editor = recordEditors[record.id];

        return (
          <textarea
            aria-label="Qualification Notes"
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-2.5 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            rows={3}
            value={editor?.qualificationNotes ?? ''}
            onChange={(event) => {
              const nextValue = event.currentTarget.value;
              setRecordEditors((currentEditors) => ({
                ...currentEditors,
                [record.id]: {
                  ...currentEditors[record.id],
                  qualificationNotes: nextValue,
                },
              }));
            }}
          />
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '14rem',
      align: 'right',
      renderCell: (record) => (
        <div className="flex flex-wrap justify-end gap-1.5">
          <CompactIconActionButton label="Open Operational Record" variant="small-secondary" onClick={() => onOpenOperationalRecord(record.id)} />
          <CompactIconActionButton label="Open Manual Intake" variant="small-secondary" onClick={() => onOpenManualIntake(record.id)} />
        </div>
      ),
    },
  ], [onOpenManualIntake, onOpenOperationalRecord, recordEditors]);

  const pricingCoverage = useMemo(() => records.every((record) => {
    const editor = recordEditors[record.id];
    if (!editor) {
      return false;
    }

    return parseCurrency(editor.offerAmount) !== null
      || parseCurrency(editor.paidAmount) !== null
      || parsedGrandTotal !== null;
  }), [parsedGrandTotal, recordEditors, records]);

  const qualificationCoverage = useMemo(() => records.every((record) => {
    const editor = recordEditors[record.id];
    return Boolean(editor && editor.qualificationNotes.trim().length > 0);
  }), [recordEditors, records]);

  const applyEqualSplit = () => {
    if (parsedGrandTotal === null) {
      setError('Confirmed Grand Total is required before applying equal split.');
      return;
    }

    const allocations = distributeUsedGearPendingReviewTotal(parsedGrandTotal, records.length);
    setAllocationMode('Equal Split');
    setRecordEditors((currentEditors) => Object.fromEntries(records.map((record, index) => [
      record.id,
      {
        ...currentEditors[record.id],
        offerAmount: allocations[index].toFixed(2),
      },
    ])));
    setError(null);
  };

  const buildReviewInput = () => ({
    submissionGroupId,
    confirmedGrandTotal: parsedGrandTotal,
    allocationMode,
    allocationNotes,
    records: records.map((record) => {
      const editor = recordEditors[record.id];
      return {
        recordId: record.id,
        acceptedStatus: editor.acceptedStatus,
        qualificationNotes: editor.qualificationNotes,
        offerAmount: parseCurrency(editor.offerAmount),
        paidAmount: parseCurrency(editor.paidAmount),
      };
    }),
  });

  const handleSaveReview = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updatedRecords = await savePendingReviewGroupReview(buildReviewInput());
      const sortedRecords = sortGroupRecords(updatedRecords);
      setGroup((currentGroup) => currentGroup ? { ...currentGroup, records: sortedRecords } : currentGroup);
      setRecordEditors(buildRecordEditors(sortedRecords));
      setSuccessMessage('Intake review fields saved for this parking-lot group.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save the intake review fields for this group.');
    } finally {
      setSaving(false);
    }
  };

  const handleAcceptGroup = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const reviewInput = buildReviewInput();
      await savePendingReviewGroupReview(reviewInput);
      await acceptPendingReviewGroup(reviewInput, currentUserName);
      onBackToParkingLot();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to accept the grouped intake review into Lot 2.');
      setSaving(false);
      return;
    }
  };

  if (loading) {
    return <LoadingSurface message="Loading parking-lot group review..." />;
  }

  if (!group) {
    return <ErrorSurface title="Unable to load parking-lot group" message={error ?? 'The selected group could not be loaded.'} />;
  }

  return (
    <PanelSurface>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <WorkflowPageHeader
          eyebrow="Parking Lot 1 Review"
          title={group.label}
          actions={(
            <button
              type="button"
              className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              onClick={onBackToParkingLot}
            >
              Back to Parking Lot 1
            </button>
          )}
        />

        {error ? <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{error}</div> : null}
        {successMessage ? <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{successMessage}</div> : null}
        <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Group Summary</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
                <div>Items</div>
                <div className="mt-1 text-2xl font-semibold text-[var(--ink)]">{records.length}</div>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
                <div>Pricing Ready</div>
                <div className="mt-1 text-2xl font-semibold text-[var(--ink)]">{pricingCoverage ? 'Yes' : 'No'}</div>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
                <div>Qualification Ready</div>
                <div className="mt-1 text-2xl font-semibold text-[var(--ink)]">{qualificationCoverage ? 'Yes' : 'No'}</div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-[var(--ink)]">Submission Group ID</span>
                <input
                  className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                  value={submissionGroupId}
                  onChange={(event) => setSubmissionGroupId(event.currentTarget.value)}
                  placeholder="Required for multi-item intake batches"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[var(--ink)]">Confirmed Grand Total</span>
                <input
                  className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                  type="number"
                  step="0.01"
                  value={confirmedGrandTotal}
                  onChange={(event) => setConfirmedGrandTotal(event.currentTarget.value)}
                  placeholder="Optional group-level total"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[var(--ink)]">Allocation Mode</span>
                <select
                  className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                  value={allocationMode}
                  onChange={(event) => setAllocationMode(event.currentTarget.value as UsedGearPendingReviewAllocationMode)}
                >
                  <option value="Equal Split">Equal Split</option>
                  <option value="Manual Override">Manual Override</option>
                </select>
              </label>
              <label className="block md:col-span-2">
                <span className="text-sm font-semibold text-[var(--ink)]">Allocation Notes</span>
                <textarea
                  className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                  rows={3}
                  value={allocationNotes}
                  onChange={(event) => setAllocationNotes(event.currentTarget.value)}
                  placeholder="Required when the group needs a manual allocation explanation"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className={smallSecondaryActionButtonClass}
                onClick={applyEqualSplit}
                disabled={saving || parsedGrandTotal === null || records.length === 0}
              >
                Apply Equal Split
              </button>
              <button
                type="button"
                className={smallSecondaryActionButtonClass}
                onClick={() => {
                  setAllocationMode('Manual Override');
                }}
                disabled={saving}
              >
                Switch To Manual Override
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Acceptance Gate</p>
            <div className="mt-4 space-y-2 text-sm text-[var(--muted)]">
              <div>Submission Group ID: <span className="font-semibold text-[var(--ink)]">{submissionGroupId.trim() || 'Missing'}</span></div>
              <div>Pricing path complete: <span className="font-semibold text-[var(--ink)]">{pricingCoverage ? 'Yes' : 'No'}</span></div>
              <div>Qualification notes complete: <span className="font-semibold text-[var(--ink)]">{qualificationCoverage ? 'Yes' : 'No'}</span></div>
            </div>
            <div className="mt-5 flex flex-col gap-3">
              <button
                type="button"
                className={smallSecondaryActionButtonClass}
                onClick={() => {
                  void handleSaveReview();
                }}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Review Fields'}
              </button>
              <button
                type="button"
                className={smallPrimaryActionButtonClass}
                onClick={() => {
                  void handleAcceptGroup();
                }}
                disabled={saving || groupNeedsSubmissionId || !pricingCoverage || !qualificationCoverage}
              >
                {saving ? 'Saving...' : 'Accept Group Into Lot 2'}
              </button>
              {groupNeedsSubmissionId ? <p className="m-0 text-xs text-amber-300">Multi-item groups require Submission Group ID before acceptance.</p> : null}
              {!pricingCoverage ? <p className="m-0 text-xs text-amber-300">Each row needs offer amount, paid amount, or the shared confirmed group total.</p> : null}
            </div>
          </div>
        </section>

        <section>
          <IntakeItemsMatrix
            items={records}
            columns={recordColumns}
            getItemKey={(record) => record.id}
          />
        </section>
      </div>
    </PanelSurface>
  );
}