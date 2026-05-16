import { useEffect, useMemo, useState } from 'react';
import { CompactIconActionButton } from '@/components/app/CompactIconActionButton';
import { IntakeItemsMatrix, type IntakeItemsMatrixColumn } from '@/components/app/IntakeItemsMatrix';
import { CollapsibleHelperText } from '@/components/app/CollapsibleHelperText';
import { ErrorSurface, LoadingSurface, PanelSurface } from '@/components/app/StateSurfaces';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import { displayInventoryValue } from '@/services/inventoryDirectory';
import {
  buildUsedGearManualIntakePath,
  shouldShowOperationalAction,
} from '@/services/usedGearOperationalRouting';
import { loadLotTwoGroup, type UsedGearWorkflowGroup } from '@/services/usedGearQueue';
import type { AirtableRecord } from '@/types/airtable';

interface UsedGearLotTwoGroupPageProps {
  onBackToParkingLot: () => void;
  groupId: string;
  onOpenManualIntake: (recordId: string) => void;
  onOpenOperationalRecord: (recordId: string) => void;
}

const intakeDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

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

function formatIntakeDate(record: AirtableRecord): string {
  const timestamp = intakeTimestamp(record);
  return Number.isFinite(timestamp) ? intakeDateFormatter.format(new Date(timestamp)) : 'Unknown';
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
  groupId,
  onBackToParkingLot,
  onOpenManualIntake,
  onOpenOperationalRecord,
}: UsedGearLotTwoGroupPageProps) {
  const [group, setGroup] = useState<UsedGearWorkflowGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadGroup = async () => {
      setLoading(true);
      setError(null);

      try {
        const nextGroup = await loadLotTwoGroup(groupId);
        if (!cancelled) {
          setGroup({ ...nextGroup, records: sortGroupRecords(nextGroup.records) });
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
  const arrivedCount = useMemo(
    () => records.filter((record) => stringFieldValue(record, 'Workflow Status') === 'Accepted - Arrived, Awaiting SKU').length,
    [records],
  );
  const missingItemCount = useMemo(
    () => records.filter((record) => stringFieldValue(record, 'Workflow Status') === 'Accepted - Arrived, Awaiting Missing Item').length,
    [records],
  );

  if (loading) {
    return <LoadingSurface message="Loading Parking Lot 2 handoff..." />;
  }

  if (!group) {
    return <ErrorSurface title="Unable to load Parking Lot 2 handoff" message={error ?? 'The selected Parking Lot 2 set could not be loaded.'} />;
  }

  return (
    <PanelSurface>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <WorkflowPageHeader
          eyebrow="Parking Lot 2 Handoff"
          title={group.label}
          description="Work this arrival-stage set in one place, then move each record into Manual Intake or its current operational follow-up when the intake handoff is ready."
          actions={(
            <button
              type="button"
              className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              onClick={onBackToParkingLot}
            >
              Back to Parking Lot 2
            </button>
          )}
        />

        <div className="max-w-3xl">
          <CollapsibleHelperText label="Handoff guide">
            Use this page when one arrival-stage set needs coordinated arrival handling before the records leave Parking Lot 2. The queue still handles prioritization and shareable focus links; this page handles the grouped handoff itself.
          </CollapsibleHelperText>
        </div>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Set Summary</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
                <div>Items</div>
                <div className="mt-1 text-2xl font-semibold text-[var(--ink)]">{records.length}</div>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
                <div>Arrived</div>
                <div className="mt-1 text-2xl font-semibold text-[var(--ink)]">{arrivedCount}</div>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
                <div>Missing Item Follow-Up</div>
                <div className="mt-1 text-2xl font-semibold text-[var(--ink)]">{missingItemCount}</div>
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Shared Context</p>
            <dl className="mt-4 space-y-3 text-sm text-[var(--muted)]">
              <div>
                <dt className="font-semibold text-[var(--ink)]">Set Type</dt>
                <dd className="m-0">{group.description}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--ink)]">Submission Group</dt>
                <dd className="m-0">{displayInventoryValue(records[0]?.fields['Submission Group ID'])}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--ink)]">Pick Up ID</dt>
                <dd className="m-0">{displayInventoryValue(records[0]?.fields['Pick Up ID'])}</dd>
              </div>
            </dl>
          </aside>
        </section>

        <section>
          <IntakeItemsMatrix
            items={records}
            getItemKey={(record) => record.id}
            columns={records.length > 0 ? [
              {
                key: 'sku',
                label: 'SKU',
                width: '9rem',
                renderCell: (record) => <span className="font-semibold text-[var(--ink)]">{displayInventoryValue(record.fields.SKU)}</span>,
              },
              {
                key: 'item',
                label: 'Item',
                width: 'minmax(0,1.45fr)',
                renderCell: (record) => (
                  <div className="min-w-0">
                    <div className="truncate text-sm text-[var(--ink)]">{displayInventoryValue(record.fields.Make)} · {displayInventoryValue(record.fields.Model)}</div>
                    <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                      <span>{displayInventoryValue(record.fields['Workflow Source'])}</span>
                      <span>{displayInventoryValue(record.fields['Workflow Status'])}</span>
                    </div>
                  </div>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                width: '14rem',
                renderCell: (record) => <span className="text-xs text-[var(--muted)]">{displayInventoryValue(record.fields['Workflow Status'])}</span>,
              },
              {
                key: 'intake',
                label: 'Intake',
                width: '8rem',
                renderCell: (record) => <span className="text-xs text-[var(--muted)]">{formatIntakeDate(record)}</span>,
              },
              {
                key: 'actions',
                label: 'Actions',
                width: '18rem',
                align: 'right',
                renderCell: (record) => {
                  const showOperationalAction = shouldShowOperationalAction(record.id, record.fields, [
                    buildUsedGearManualIntakePath(record.id),
                  ]);

                  return (
                    <div className="flex flex-wrap gap-1.5 xl:justify-end">
                      <CompactIconActionButton label="Open Manual Intake" variant="compact-primary" onClick={() => onOpenManualIntake(record.id)} />
                      {showOperationalAction ? (
                        <CompactIconActionButton label="Open Operational Record" onClick={() => onOpenOperationalRecord(record.id)} />
                      ) : null}
                    </div>
                  );
                },
              },
            ] as IntakeItemsMatrixColumn<AirtableRecord>[] : []}
          />
        </section>
      </div>
    </PanelSurface>
  );
}