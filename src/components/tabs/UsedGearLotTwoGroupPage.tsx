import { useEffect, useMemo, useState } from 'react';
import { BackToolbarButton } from '@/components/app/BackToolbarButton';
import { CompactIconActionButton } from '@/components/app/CompactIconActionButton';
import { MainPageSectionNav } from '@/components/app/MainPageSectionNav';
import { usePageSectionTracking } from '@/components/app/usePageSectionTracking';
import { secondaryActionButtonClass } from '@/components/app/buttonStyles';
import { UsedGearTrashRouteCard } from '@/components/tabs/UsedGearTrashRouteCard';
import { DatePickerField } from '@/components/tabs/date-picker-field';
import { WorkflowRecordPageLayout } from '@/components/app/WorkflowRecordPageLayout';
import { ErrorSurface, LoadingSurface } from '@/components/app/StateSurfaces';
import { applyUsedGearWorkflowNoteTemplate } from '@/services/usedGearWorkflowNoteTemplates';
import { displayInventoryValue } from '@/services/inventoryDirectory';
import {
  completeProcessingStage,
  loadLotTwoGroup,
  markPendingReviewUnqualified,
  saveLotTwoReviewRecord,
  type UsedGearWorkflowGroup,
} from '@/services/usedGearQueue';
import type { AirtableRecord } from '@/types/airtable';

interface UsedGearLotTwoGroupPageProps {
  currentUserName: string;
  onBackToParkingLot: () => void;
  groupId: string;
  onOpenTrashReview: () => void;
  onOpenManualIntake: (recordId: string) => void;
}

type LotTwoGroupSectionKey = 'review' | 'trash';

interface LotTwoGroupRecordEditor {
  arrivalDate: string;
  sku: string;
}

function stringFieldValue(record: AirtableRecord, fieldName: string): string {
  const value = record.fields[fieldName];
  return typeof value === 'string' ? value : '';
}

function intakeTimestamp(record: AirtableRecord): number {
  const arrivalDate = stringFieldValue(record, 'Arrival Date');
  const parsedArrival = arrivalDate ? Date.parse(arrivalDate) : Number.NaN;
  if (Number.isFinite(parsedArrival)) {
    return parsedArrival;
  }
  const createdTime = Date.parse(record.createdTime);
  return Number.isFinite(createdTime) ? createdTime : Number.POSITIVE_INFINITY;
}

function sortGroupRecords(records: AirtableRecord[]): AirtableRecord[] {
  return [...records].sort((left, right) => {
    const timestampDelta = intakeTimestamp(left) - intakeTimestamp(right);
    if (timestampDelta !== 0) {
      return timestampDelta;
    }
    const makeDelta = stringFieldValue(left, 'Make').localeCompare(stringFieldValue(right, 'Make'));
    if (makeDelta !== 0) {
      return makeDelta;
    }
    return stringFieldValue(left, 'Model').localeCompare(stringFieldValue(right, 'Model'));
  });
}

export function UsedGearLotTwoGroupPage({
  currentUserName,
  groupId,
  onBackToParkingLot,
  onOpenTrashReview,
  onOpenManualIntake,
}: UsedGearLotTwoGroupPageProps) {
  const [group, setGroup] = useState<UsedGearWorkflowGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'save' | 'complete' | 'trash' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [recordEditors, setRecordEditors] = useState<Record<string, LotTwoGroupRecordEditor>>({});
  const [unqualifiedReason, setUnqualifiedReason] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadGroup = async () => {
      setLoading(true);
      setError(null);

      try {
        const nextGroup = await loadLotTwoGroup(groupId);
        if (!cancelled) {
          const sortedRecords = sortGroupRecords(nextGroup.records);
          setGroup({ ...nextGroup, records: sortedRecords });
          setRecordEditors(Object.fromEntries(sortedRecords.map((record) => [record.id, {
            arrivalDate: stringFieldValue(record, 'Arrival Date').slice(0, 10),
            sku: stringFieldValue(record, 'SKU'),
          }])));
          setUnqualifiedReason(stringFieldValue(sortedRecords[0] ?? nextGroup.records[0]!, 'Unqualified Reason'));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load the selected Parking Lot 2 handoff set.');
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
  const sectionItems = useMemo<Array<{ id: LotTwoGroupSectionKey; key: LotTwoGroupSectionKey; label: string }>>(() => [
    { id: 'review', key: 'review', label: 'Group Review' },
    { id: 'trash', key: 'trash', label: 'Trash' },
  ], []);
  const { activeSectionId, scrollToSection } = usePageSectionTracking(sectionItems, 'review');
  const sectionNav = (
    <MainPageSectionNav
      ariaLabel="Parking Lot 2 group sections"
      items={sectionItems.map((item) => ({ key: item.key, label: item.label }))}
      activeKey={activeSectionId as LotTwoGroupSectionKey}
      onSelect={(sectionKey) => scrollToSection(sectionKey)}
    />
  );
  const dateButtonClassName = 'inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20';
  const inputClassName = 'w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';
  const readyRecordIds = useMemo(
    () => records
      .filter((record) => {
        const editor = recordEditors[record.id];
        return Boolean(editor?.arrivalDate.trim() && editor?.sku.trim());
      })
      .map((record) => record.id),
    [recordEditors, records],
  );

  const refreshGroup = async () => {
    const nextGroup = await loadLotTwoGroup(groupId);
    const sortedRecords = sortGroupRecords(nextGroup.records);
    setGroup({ ...nextGroup, records: sortedRecords });
    setRecordEditors(Object.fromEntries(sortedRecords.map((record) => [record.id, {
      arrivalDate: stringFieldValue(record, 'Arrival Date').slice(0, 10),
      sku: stringFieldValue(record, 'SKU'),
    }])));
  };

  const handleSaveReview = async () => {
    if (records.length === 0) {
      return;
    }

    setSaving('save');
    setError(null);
    setSuccessMessage(null);

    try {
      const updatedRecords = await Promise.all(records.map((record) => {
        const editor = recordEditors[record.id];
        return saveLotTwoReviewRecord(record.id, {
          arrivalDate: editor?.arrivalDate ?? '',
          sku: editor?.sku ?? '',
        });
      }));
      const sortedRecords = sortGroupRecords(updatedRecords);
      setGroup((currentGroup) => currentGroup ? { ...currentGroup, records: sortedRecords } : currentGroup);
      setRecordEditors(Object.fromEntries(sortedRecords.map((record) => [record.id, {
        arrivalDate: stringFieldValue(record, 'Arrival Date').slice(0, 10),
        sku: stringFieldValue(record, 'SKU'),
      }])));
      setSuccessMessage('Saved Parking Lot 2 review fields for this batch.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save the Parking Lot 2 review fields for this batch.');
    } finally {
      setSaving(null);
    }
  };

  const handleCompleteReadyItems = async () => {
    if (readyRecordIds.length === 0) {
      return;
    }

    setSaving('complete');
    setError(null);
    setSuccessMessage(null);

    try {
      await Promise.all(records.map((record) => {
        const editor = recordEditors[record.id];
        return saveLotTwoReviewRecord(record.id, {
          arrivalDate: editor?.arrivalDate ?? '',
          sku: editor?.sku ?? '',
        });
      }));
      await Promise.all(readyRecordIds.map((recordId) => completeProcessingStage(recordId, currentUserName)));

      try {
        await refreshGroup();
        setSuccessMessage(`Moved ${readyRecordIds.length} item${readyRecordIds.length === 1 ? '' : 's'} into processing.`);
      } catch {
        onBackToParkingLot();
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to move the ready Parking Lot 2 items into processing.');
      setSaving(null);
      return;
    }

    setSaving(null);
  };

  const handleSendGroupToTrash = async () => {
    if (records.length === 0 || unqualifiedReason.trim().length === 0) {
      return;
    }

    setSaving('trash');
    setError(null);
    setSuccessMessage(null);

    try {
      await Promise.all(records.map((record) => markPendingReviewUnqualified(record.id, unqualifiedReason)));
      onOpenTrashReview();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to move this Parking Lot 2 batch into Trash Review.');
      setSaving(null);
    }
  };

  if (loading) {
    return <LoadingSurface message="Loading Parking Lot 2 handoff..." />;
  }

  if (!group) {
    return <ErrorSurface title="Unable to load Parking Lot 2 handoff" message={error ?? 'The selected Parking Lot 2 set could not be loaded.'} />;
  }

  return (
    <WorkflowRecordPageLayout
      eyebrow="Parking Lot 2"
      title={group.label}
      belowHeader={sectionNav}
      actions={(
        <BackToolbarButton label="Back to Parking Lot 2" onClick={onBackToParkingLot} />
      )}
    >
        {error ? <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{error}</div> : null}
        {successMessage ? <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{successMessage}</div> : null}

        <section id="review" className="scroll-mt-28">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-3 pt-1">
              <h2 className="m-0 text-[1.05rem] font-semibold text-[var(--ink)]">Group Review</h2>
            </div>
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              {records.map((record) => {
                return (
                  <article key={record.id} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4 shadow-[0_8px_24px_rgba(17,32,49,0.05)]">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="text-lg font-semibold text-[var(--ink)]">{displayInventoryValue(record.fields.Make)} · {displayInventoryValue(record.fields.Model)}</div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 md:justify-end">
                        <CompactIconActionButton label="Open Intake" variant="small-secondary" icon="edit" onClick={() => onOpenManualIntake(record.id)} />
                      </div>
                    </div>

                      <div className="mt-4 border-t border-[var(--line)] pt-4 grid gap-4">
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Arrival Date</span>
                          <DatePickerField
                            containerClassName="mt-2 flex gap-2"
                            inputClassName={`${inputClassName} flex-1`}
                            buttonClassName={dateButtonClassName}
                            value={recordEditors[record.id]?.arrivalDate ?? ''}
                            pickerLabel="Arrival Date"
                            onValueChange={(nextValue) => {
                              setRecordEditors((currentEditors) => ({
                                ...currentEditors,
                                [record.id]: {
                                  ...currentEditors[record.id],
                                  arrivalDate: nextValue,
                                },
                              }));
                            }}
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">SKU</span>
                          <input
                            type="text"
                            aria-label="SKU"
                            className={`${inputClassName} mt-2`}
                            value={recordEditors[record.id]?.sku ?? ''}
                            onChange={(event) => {
                              const nextValue = event.currentTarget.value;
                              setRecordEditors((currentEditors) => ({
                                ...currentEditors,
                                [record.id]: {
                                  ...currentEditors[record.id],
                                  sku: nextValue,
                                },
                              }));
                            }}
                            placeholder="Required before processing is complete"
                          />
                        </label>
                      </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className={`${secondaryActionButtonClass} w-full py-3`}
                onClick={() => {
                  void handleSaveReview();
                }}
                disabled={saving !== null}
              >
                {saving === 'save' ? 'Saving...' : 'Save Review'}
              </button>
              <button
                type="button"
                className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  void handleCompleteReadyItems();
                }}
                disabled={saving !== null || readyRecordIds.length === 0}
              >
                {saving === 'complete' ? 'Moving...' : 'Complete Ready Items'}
              </button>
            </div>

            {readyRecordIds.length === 0 ? (
              <p className="mt-3 m-0 text-sm text-amber-300">Add Arrival Date and SKU to at least one item before moving it out of Parking Lot 2.</p>
            ) : readyRecordIds.length < records.length ? (
              <p className="mt-3 m-0 text-sm text-amber-300">Arrival Date and SKU are required before each remaining item can leave Parking Lot 2.</p>
            ) : null}
          </div>
        </section>

        <UsedGearTrashRouteCard
          sectionId="trash"
          description=""
          reason={unqualifiedReason}
          onReasonChange={setUnqualifiedReason}
          onApplyTemplate={(templateValue) => {
            setUnqualifiedReason((currentValue) => applyUsedGearWorkflowNoteTemplate(currentValue, templateValue));
          }}
          onSubmit={() => {
            void handleSendGroupToTrash();
          }}
          disabled={saving !== null || unqualifiedReason.trim().length === 0}
          textareaClassName={inputClassName}
          isSaving={saving === 'trash'}
        />
    </WorkflowRecordPageLayout>
  );
}