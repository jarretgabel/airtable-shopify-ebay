import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BackToolbarButton } from '@/components/app/BackToolbarButton';
import { AppSectionTitle } from '@/components/app/AppSectionTitle';
import { CompactIconActionButton } from '@/components/app/CompactIconActionButton';
import { MainPageSectionNav } from '@/components/app/MainPageSectionNav';
import { WorkflowRecordPageLayout } from '@/components/app/WorkflowRecordPageLayout';
import { ErrorSurface, LoadingSurface } from '@/components/app/StateSurfaces';
import { usePageSectionTracking } from '@/components/app/usePageSectionTracking';
import { DatePickerField } from '@/components/tabs/date-picker-field';
import { IntakeSnapshotSection } from '@/components/tabs/IntakeSnapshotSection';
import { buildUsedGearIntakeSnapshot } from '@/components/tabs/usedGearIntakeSnapshot';
import {
  completeProcessingStage,
  loadUsedGearOperationalRecordContext,
  saveLotTwoReviewRecord,
  type UsedGearOperationalRecordContext,
} from '@/services/usedGearQueue';
import { displayInventoryValue } from '@/services/inventoryDirectory';
import { resolveUsedGearOperationalPath } from '@/services/usedGearOperationalRouting';

interface UsedGearLotTwoRecordPageProps {
  currentUserName: string;
  recordId: string;
  onOpenManualIntake: (recordId: string) => void;
}

type LotTwoRecordSectionKey = 'group' | 'review' | 'snapshot';

function stringFieldValue(fields: Record<string, unknown>, fieldName: string): string {
  const value = fields[fieldName];
  return typeof value === 'string' ? value : '';
}

function dateFieldValue(fields: Record<string, unknown>, fieldName: string): string {
  const value = stringFieldValue(fields, fieldName).trim();
  return value ? value.slice(0, 10) : '';
}

export function UsedGearLotTwoRecordPage({
  currentUserName,
  recordId,
  onOpenManualIntake,
}: UsedGearLotTwoRecordPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [context, setContext] = useState<UsedGearOperationalRecordContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'save' | 'complete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [arrivalDate, setArrivalDate] = useState('');
  const [sku, setSku] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadRecord = async () => {
      setLoading(true);
      setError(null);

      try {
        const nextContext = await loadUsedGearOperationalRecordContext(recordId);
        if (!cancelled) {
          setContext(nextContext);
          setArrivalDate(dateFieldValue(nextContext.record.fields, 'Arrival Date'));
          setSku(stringFieldValue(nextContext.record.fields, 'SKU'));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load the selected Parking Lot 2 row.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadRecord();

    return () => {
      cancelled = true;
    };
  }, [recordId]);

  const record = context?.record ?? null;
  const group = context?.group ?? null;
  const processingBlocked = arrivalDate.trim().length === 0 || sku.trim().length === 0;
  const inputClassName = 'w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';
  const dateButtonClassName = 'inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20';
  const intakeSnapshot = useMemo(() => (record ? buildUsedGearIntakeSnapshot(record) : null), [record]);
  const sectionItems = useMemo<Array<{ id: LotTwoRecordSectionKey; key: LotTwoRecordSectionKey; label: string }>>(() => {
    const items: Array<{ id: LotTwoRecordSectionKey; key: LotTwoRecordSectionKey; label: string }> = [];
    if (group) {
      items.push({ id: 'group', key: 'group', label: 'Grouped Intake' });
    }
    items.push({ id: 'review', key: 'review', label: 'Review' });
    if (intakeSnapshot) {
      items.push({ id: 'snapshot', key: 'snapshot', label: 'Snapshot' });
    }
    return items;
  }, [group, intakeSnapshot]);
  const { activeSectionId, scrollToSection } = usePageSectionTracking(sectionItems, sectionItems[0]?.id ?? 'review');
  const sectionNav = (
    <MainPageSectionNav
      ariaLabel="Parking Lot 2 sections"
      items={sectionItems.map((item) => ({ key: item.key, label: item.label }))}
      activeKey={activeSectionId as LotTwoRecordSectionKey}
      onSelect={(sectionKey) => scrollToSection(sectionKey)}
    />
  );

  const backToQueue = () => {
    navigate({ pathname: '/parking-lot-2', search: location.search, hash: '#used-gear-lot-two' });
  };

  const handleSave = async () => {
    if (!record) {
      return;
    }

    setSaving('save');
    setError(null);
    setSaveMessage(null);

    try {
      const updatedRecord = await saveLotTwoReviewRecord(record.id, { arrivalDate, sku });
      setContext((current) => current ? { ...current, record: updatedRecord } : current);
      setArrivalDate(dateFieldValue(updatedRecord.fields, 'Arrival Date'));
      setSku(stringFieldValue(updatedRecord.fields, 'SKU'));
      setSaveMessage('Saved Parking Lot 2 review fields.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save the Parking Lot 2 review fields.');
    } finally {
      setSaving(null);
    }
  };

  const handleCompleteProcessing = async () => {
    if (!record || processingBlocked) {
      return;
    }

    setSaving('complete');
    setError(null);
    setSaveMessage(null);

    try {
      await saveLotTwoReviewRecord(record.id, { arrivalDate, sku });
      const updatedRecord = await completeProcessingStage(record.id, currentUserName);
      navigate(resolveUsedGearOperationalPath(updatedRecord.id, updatedRecord.fields));
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to move this Parking Lot 2 row into processing.');
      setSaving(null);
    }
  };

  if (loading) {
    return <LoadingSurface message="Loading Parking Lot 2 review..." />;
  }

  if (!record) {
    return <ErrorSurface title="Unable to load Parking Lot 2 review" message={error ?? 'The selected Parking Lot 2 row could not be loaded.'} />;
  }

  return (
    <WorkflowRecordPageLayout
      eyebrow="Parking Lots"
      title={displayInventoryValue(record.fields.SKU) || record.id}
      belowHeader={sectionNav}
      actions={<BackToolbarButton label="Back to Parking Lot 2" onClick={backToQueue} />}
    >
      <div className="space-y-6">
        {error ? (
          <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {error}
          </div>
        ) : null}

        {saveMessage ? (
          <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {saveMessage}
          </div>
        ) : null}

        {group ? (
          <section id="group" className="rounded-2xl border border-sky-400/30 bg-sky-500/10 px-5 py-4 text-sm text-sky-100 scroll-mt-28">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <AppSectionTitle title="Grouped Intake" className="border-b-sky-300/25 pt-0" titleClassName="text-lg text-sky-50" />
                <p className="mt-3 max-w-2xl leading-6">
                  This row belongs to {group.label} with {group.records.length} intake rows. Use the group page when the handoff should be reviewed together.
                </p>
              </div>
              <button
                type="button"
                className="rounded-xl border border-sky-300/40 bg-white/5 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-white/10"
                onClick={() => navigate(`/parking-lot-2/review/${encodeURIComponent(group.id)}${location.search}`)}
              >
                Open Group Review
              </button>
            </div>
          </section>
        ) : null}

        <section id="review" className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5 scroll-mt-28">
          <AppSectionTitle title="Parking Lot 2 Review" titleClassName="text-lg" className="pt-0" />
          <h3 className="mt-4 text-xl font-semibold text-[var(--ink)]">Update The Handoff Fields</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Keep this review page focused on the fields that usually block the row from moving into testing and photos.
          </p>

          <div className="mt-4 grid gap-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Arrival Date</span>
              <DatePickerField
                containerClassName="mt-2 flex gap-2"
                inputClassName={`${inputClassName} flex-1`}
                buttonClassName={dateButtonClassName}
                value={arrivalDate}
                pickerLabel="Arrival Date"
                onValueChange={setArrivalDate}
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">SKU</span>
              <input
                type="text"
                className={inputClassName}
                value={sku}
                onChange={(event) => setSku(event.currentTarget.value)}
                placeholder="Required before processing is complete"
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  void handleSave();
                }}
                disabled={saving !== null}
              >
                {saving === 'save' ? 'Saving...' : 'Save Review'}
              </button>
              <button
                type="button"
                className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  void handleCompleteProcessing();
                }}
                disabled={saving !== null || processingBlocked}
              >
                {saving === 'complete' ? 'Moving...' : 'Complete Processing'}
              </button>
            </div>

            {processingBlocked ? (
              <p className="m-0 text-sm text-amber-300">
                Arrival Date and SKU are required before this row can leave Parking Lot 2.
              </p>
            ) : null}
          </div>
        </section>

        {intakeSnapshot ? (
          <IntakeSnapshotSection
            sectionId="snapshot"
            className="scroll-mt-28"
            title="Intake Snapshot"
            actions={<CompactIconActionButton label="Edit Intake" variant="small-secondary" icon="edit" onClick={() => onOpenManualIntake(record.id)} />}
            fields={intakeSnapshot.fields}
            cards={intakeSnapshot.cards}
          />
        ) : null}
      </div>
    </WorkflowRecordPageLayout>
  );
}