import { useEffect, useMemo, useState } from 'react';
import { AppSectionTitle } from '@/components/app/AppSectionTitle';
import { BackToolbarButton } from '@/components/app/BackToolbarButton';
import { CompactIconActionButton } from '@/components/app/CompactIconActionButton';
import { MainPageSectionNav } from '@/components/app/MainPageSectionNav';
import { usePageSectionTracking } from '@/components/app/usePageSectionTracking';
import { UsedGearTrashRouteCard } from '@/components/tabs/UsedGearTrashRouteCard';
import { secondaryActionButtonClass } from '@/components/app/buttonStyles';
import { WorkflowRecordPageLayout } from '@/components/app/WorkflowRecordPageLayout';
import { ErrorSurface, LoadingSurface } from '@/components/app/StateSurfaces';
import {
  acceptPendingReviewGroup,
  loadPendingReviewGroup,
  markPendingReviewGroupUnqualified,
  savePendingReviewGroupReview,
  type UsedGearPendingReviewAcceptedStatus,
  type UsedGearPendingReviewAllocationMode,
  type UsedGearWorkflowGroup,
} from '@/services/usedGearQueue';
import { displayInventoryValue } from '@/services/inventoryDirectory';
import { applyUsedGearWorkflowNoteTemplate, getUsedGearWorkflowNoteTemplates } from '@/services/usedGearWorkflowNoteTemplates';
import type { AirtableRecord } from '@/types/airtable';

interface UsedGearPendingReviewGroupPageProps {
  currentUserName: string;
  groupId: string;
  onBackToParkingLot: () => void;
  onOpenTrashReview: () => void;
  onOpenManualIntake: (recordId: string) => void;
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

type PendingReviewGroupSectionKey = 'review' | 'grouped-items' | 'trash';

function NoteTemplateRow({
  onApplyTemplate,
}: {
  onApplyTemplate: (templateValue: string) => void;
}) {
  const templates = getUsedGearWorkflowNoteTemplates('qualification');

  return (
    <div className="mt-3 rounded-2xl border border-[var(--line)] bg-[color:color-mix(in_srgb,var(--panel)_72%,transparent)] p-3">
      <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]/85">Quick templates</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)] shadow-[0_4px_14px_rgba(17,32,49,0.04)] transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--panel)] hover:text-[var(--ink)]"
            onClick={() => onApplyTemplate(template.value)}
          >
            {template.label}
          </button>
        ))}
      </div>
    </div>
  );
}

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
  onOpenTrashReview,
  onOpenManualIntake,
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
  const [unqualifiedReason, setUnqualifiedReason] = useState('');
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
          setUnqualifiedReason(stringFieldValue(sortedRecords[0]!, 'Unqualified Reason'));
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
  const sectionItems = useMemo<Array<{ id: PendingReviewGroupSectionKey; key: PendingReviewGroupSectionKey; label: string }>>(() => [
    { id: 'review', key: 'review', label: 'Review' },
    { id: 'grouped-items', key: 'grouped-items', label: 'Grouped Items' },
    { id: 'trash', key: 'trash', label: 'Trash' },
  ], []);
  const { activeSectionId, scrollToSection } = usePageSectionTracking(sectionItems, 'review');
  const sectionNav = (
    <MainPageSectionNav
      ariaLabel="Parking Lot group sections"
      items={sectionItems.map((item) => ({ key: item.key, label: item.label }))}
      activeKey={activeSectionId as PendingReviewGroupSectionKey}
      onSelect={(sectionKey) => scrollToSection(sectionKey)}
    />
  );

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
      setError(saveError instanceof Error ? saveError.message : 'Unable to accept the grouped intake review into Parking Lot.');
      setSaving(false);
      return;
    }
  };

  const handleSendGroupToTrash = async () => {
    if (records.length === 0 || unqualifiedReason.trim().length === 0) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await markPendingReviewGroupUnqualified(records.map((record) => record.id), unqualifiedReason);
      onOpenTrashReview();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to route this grouped intake review into Trash Review.');
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSurface message="Loading parking-lot group review..." />;
  }

  if (!group) {
    return <ErrorSurface title="Unable to load parking-lot group" message={error ?? 'The selected group could not be loaded.'} />;
  }

  return (
    <WorkflowRecordPageLayout
      eyebrow="Parking Lot"
      title={group.label}
      belowHeader={sectionNav}
      actions={(
        <BackToolbarButton label="Back to Parking Lot" onClick={onBackToParkingLot} />
      )}
    >

        {error ? <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{error}</div> : null}
        {successMessage ? <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{successMessage}</div> : null}
        <section id="review" className="scroll-mt-28">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
            <AppSectionTitle title="Group Review" />

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

            <div id="grouped-items" className="mt-6 scroll-mt-28">
              <AppSectionTitle title="Grouped Items" className="mb-4" />
              <div className="grid gap-4 xl:grid-cols-2">
                {records.map((record) => {
                  const editor = recordEditors[record.id];

                  return (
                    <article key={record.id} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4 shadow-[0_8px_24px_rgba(17,32,49,0.05)]">
                      <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">SKU</div>
                          <div className="mt-1 text-lg font-semibold text-[var(--ink)]">{displayInventoryValue(record.fields.SKU)}</div>
                          <div className="mt-2 text-sm text-[var(--ink)]">{displayInventoryValue(record.fields.Make)} · {displayInventoryValue(record.fields.Model)}</div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 md:justify-end">
                          <CompactIconActionButton label="Open Intake" variant="small-secondary" icon="edit" onClick={() => onOpenManualIntake(record.id)} />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Parking Lot Status</span>
                          <select
                            aria-label="Parking Lot Status"
                            className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
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
                        </label>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Offer</span>
                            <input
                              aria-label="Offer Amount"
                              className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
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
                          </label>

                          <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Paid</span>
                            <input
                              aria-label="Paid Amount"
                              className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
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
                          </label>
                        </div>
                      </div>

                      <label className="mt-4 block">
                        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Qualification Notes</span>
                        <textarea
                          aria-label="Qualification Notes"
                          className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                          rows={4}
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
                      </label>

                      <NoteTemplateRow
                        onApplyTemplate={(templateValue) => {
                          setRecordEditors((currentEditors) => ({
                            ...currentEditors,
                            [record.id]: {
                              ...currentEditors[record.id],
                              qualificationNotes: applyUsedGearWorkflowNoteTemplate(
                                currentEditors[record.id]?.qualificationNotes ?? '',
                                templateValue,
                              ),
                            },
                          }));
                        }}
                      />
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className={`${secondaryActionButtonClass} w-full py-3`}
                onClick={() => {
                  void handleSaveReview();
                }}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Review'}
              </button>
              <button
                type="button"
                className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  void handleAcceptGroup();
                }}
                disabled={saving || groupNeedsSubmissionId || !pricingCoverage || !qualificationCoverage}
              >
                {saving ? 'Saving...' : 'Accept Group Into Parking Lot'}
              </button>
            </div>

            {groupNeedsSubmissionId ? <p className="mt-3 m-0 text-sm text-amber-300">Multi-item groups require Submission Group ID before acceptance.</p> : null}
            {!pricingCoverage ? <p className="mt-3 m-0 text-sm text-amber-300">Each row needs offer amount, paid amount, or the shared confirmed group total.</p> : null}
          </div>
        </section>

        <UsedGearTrashRouteCard
          sectionId="trash"
          description="Use one shared unqualified reason when the entire grouped intake should stop here and move into Trash Review together."
          reason={unqualifiedReason}
          onReasonChange={setUnqualifiedReason}
          onApplyTemplate={(templateValue) => {
            setUnqualifiedReason((currentValue) => applyUsedGearWorkflowNoteTemplate(currentValue, templateValue));
          }}
          onSubmit={handleSendGroupToTrash}
          disabled={saving || unqualifiedReason.trim().length === 0}
          textareaClassName="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          isSaving={saving}
        />
    </WorkflowRecordPageLayout>
  );
}