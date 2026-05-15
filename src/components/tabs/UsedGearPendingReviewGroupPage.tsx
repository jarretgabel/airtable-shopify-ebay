import { useEffect, useMemo, useState } from 'react';
import { CollapsibleHelperText } from '@/components/app/CollapsibleHelperText';
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
  onOpenIncomingGearForm: (recordId: string) => void;
  onOpenWorkflowRecord: (recordId: string) => void;
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
  onOpenIncomingGearForm,
  onOpenWorkflowRecord,
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
          description="Review grouped intake pricing, allocation, and Lot 2 routing in one place before the items leave Parking Lot 1."
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

        <div className="max-w-3xl">
          <CollapsibleHelperText label="Grouped review guide">
            Use the shared controls for batch-level totals and allocation, then finish per-row routing and notes below. Keep group acceptance for the end so pricing and qualification are fully complete before Lot 2 handoff.
          </CollapsibleHelperText>
        </div>

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

        <section className="space-y-4">
          {records.map((record) => {
            const editor = recordEditors[record.id];
            return (
              <article key={record.id} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{displayInventoryValue(record.fields['Workflow Source'])}</p>
                    <h3 className="mt-2 text-xl font-semibold text-[var(--ink)]">{displayInventoryValue(record.fields.SKU)}</h3>
                    <p className="mt-2 text-sm text-[var(--muted)]">{displayInventoryValue(record.fields.Make)} · {displayInventoryValue(record.fields.Model)}</p>
                    <p className="mt-2 text-sm text-[var(--muted)]">Arrival Date: {displayInventoryValue(record.fields['Arrival Date'])}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={smallSecondaryActionButtonClass}
                      onClick={() => onOpenWorkflowRecord(record.id)}
                    >
                      Workflow Detail
                    </button>
                    <button
                      type="button"
                      className={smallSecondaryActionButtonClass}
                      onClick={() => onOpenIncomingGearForm(record.id)}
                    >
                      Open Incoming Gear
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Lot 2 Route</span>
                    <select
                      className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                      value={editor?.acceptedStatus ?? 'Accepted - Awaiting Arrival'}
                      onChange={(event) => setRecordEditors((currentEditors) => ({
                        ...currentEditors,
                        [record.id]: {
                          ...currentEditors[record.id],
                          acceptedStatus: event.currentTarget.value as UsedGearPendingReviewAcceptedStatus,
                        },
                      }))}
                    >
                      {ACCEPT_ROUTE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Offer Amount</span>
                    <input
                      className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                      type="number"
                      step="0.01"
                      value={editor?.offerAmount ?? ''}
                      onChange={(event) => setRecordEditors((currentEditors) => ({
                        ...currentEditors,
                        [record.id]: {
                          ...currentEditors[record.id],
                          offerAmount: event.currentTarget.value,
                        },
                      }))}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Paid Amount</span>
                    <input
                      className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                      type="number"
                      step="0.01"
                      value={editor?.paidAmount ?? ''}
                      onChange={(event) => setRecordEditors((currentEditors) => ({
                        ...currentEditors,
                        [record.id]: {
                          ...currentEditors[record.id],
                          paidAmount: event.currentTarget.value,
                        },
                      }))}
                    />
                  </label>
                  <label className="block lg:col-span-2 xl:col-span-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Qualification Notes</span>
                    <textarea
                      className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                      rows={3}
                      value={editor?.qualificationNotes ?? ''}
                      onChange={(event) => setRecordEditors((currentEditors) => ({
                        ...currentEditors,
                        [record.id]: {
                          ...currentEditors[record.id],
                          qualificationNotes: event.currentTarget.value,
                        },
                      }))}
                    />
                  </label>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 text-sm text-[var(--muted)]">
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-3">
                    Customer Cosmetic Notes: {displayInventoryValue(record.fields['Customer Cosmetic Notes'])}
                  </div>
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-3">
                    Customer Functional Notes: {displayInventoryValue(record.fields['Customer Functional Notes'])}
                  </div>
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-3">
                    Customer Inclusion Notes: {displayInventoryValue(record.fields['Customer Inclusion Notes'])}
                  </div>
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-3">
                    Inventory Notes: {displayInventoryValue(record.fields['Inventory Notes'])}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </PanelSurface>
  );
}