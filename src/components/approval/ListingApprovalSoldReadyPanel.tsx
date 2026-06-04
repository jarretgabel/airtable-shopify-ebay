import { useEffect, useMemo, useState } from 'react';
import {
  loadUsedGearOperationalRecordContext,
  markWorkflowCancelled,
  markWorkflowPartialRefund,
  markWorkflowRefunded,
  markWorkflowReturnReceived,
  markWorkflowShipped,
} from '@/services/usedGearQueue';
import { getUsedGearWorkflowPostPublishSnapshot } from '@/services/usedGearWorkflowLifecycle';
import { primaryActionButtonClass } from '@/components/app/buttonStyles';
import { IntakeSnapshotSection } from '@/components/tabs/IntakeSnapshotSection';
import { displayValue } from '@/stores/approvalStore';
import type { AirtableRecord } from '@/types/airtable';

interface ListingApprovalSoldReadyPanelProps {
  selectedRecord: AirtableRecord;
  tableReference: string;
  tableName?: string;
  loadRecords: (tableReference: string, tableName?: string, force?: boolean) => Promise<void>;
}

function getWorkflowStatusLabel(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : 'Unknown';
}

function formatTimestamp(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return '—';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
}

export function ListingApprovalSoldReadyPanel({
  selectedRecord,
  tableReference,
  tableName,
  loadRecords,
}: ListingApprovalSoldReadyPanelProps) {
  const [workflowRecord, setWorkflowRecord] = useState(selectedRecord);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setWorkflowRecord(selectedRecord);
  }, [selectedRecord]);

  useEffect(() => {
    let cancelled = false;

    const loadContext = async () => {
      try {
        const nextContext = await loadUsedGearOperationalRecordContext(selectedRecord.id);
        if (cancelled) {
          return;
        }

        setWorkflowRecord(nextContext.record);
      } catch {
        if (!cancelled) {
          setWorkflowRecord(selectedRecord);
        }
      }
    };

    void loadContext();

    return () => {
      cancelled = true;
    };
  }, [selectedRecord.id]);

  const postPublishSnapshot = useMemo(() => getUsedGearWorkflowPostPublishSnapshot(workflowRecord), [workflowRecord]);
  const workflowStatus = postPublishSnapshot?.status ?? getWorkflowStatusLabel(workflowRecord.fields['Workflow Status']);
  const actionStatus = postPublishSnapshot?.postSaleOutcome ?? workflowStatus;
  const shipNotes = typeof workflowRecord.fields['Shipment Follow-Through Notes'] === 'string'
    ? workflowRecord.fields['Shipment Follow-Through Notes']
    : '';
  const noOutcomeYet = !postPublishSnapshot?.postSaleOutcome;
  const showMarkShipped = workflowStatus === 'Sold - Ready to Ship';
  const showMarkCancelled = (workflowStatus === 'Sold - Ready to Ship' || workflowStatus === 'Shipped') && noOutcomeYet;
  const showMarkPartialRefund = (workflowStatus === 'Sold - Ready to Ship' || workflowStatus === 'Shipped') && noOutcomeYet;
  const showMarkRefunded = (workflowStatus === 'Sold - Ready to Ship' || workflowStatus === 'Shipped') && noOutcomeYet;
  const showMarkReturnReceived = workflowStatus === 'Shipped' && noOutcomeYet;

  const actionOptions = useMemo(() => {
    const options: Array<{ value: string; label: string; run: () => Promise<AirtableRecord> }> = [];

    if (showMarkShipped) {
      options.push({
        value: 'shipped',
        label: 'Shipped',
        run: () => markWorkflowShipped(selectedRecord.id),
      });
    }

    if (showMarkCancelled) {
      options.push({
        value: 'cancelled',
        label: 'Cancelled',
        run: () => markWorkflowCancelled(selectedRecord.id),
      });
    }

    if (showMarkPartialRefund) {
      options.push({
        value: 'partial-refund',
        label: 'Partial Refund',
        run: () => markWorkflowPartialRefund(selectedRecord.id),
      });
    }

    if (showMarkRefunded) {
      options.push({
        value: 'refunded',
        label: 'Refunded',
        run: () => markWorkflowRefunded(selectedRecord.id),
      });
    }

    if (showMarkReturnReceived) {
      options.push({
        value: 'return-received',
        label: 'Return Received',
        run: () => markWorkflowReturnReceived(selectedRecord.id),
      });
    }

    return options;
  }, [
    selectedRecord.id,
    showMarkCancelled,
    showMarkPartialRefund,
    showMarkRefunded,
    showMarkReturnReceived,
    showMarkShipped,
  ]);

  const [selectedAction, setSelectedAction] = useState('');

  useEffect(() => {
    if (actionOptions.length === 0) {
      setSelectedAction('');
      return;
    }

    setSelectedAction((current) => (actionOptions.some((option) => option.value === current) ? current : ''));
  }, [actionOptions]);

  const runAction = async (action: () => Promise<AirtableRecord>) => {
    setSaving(true);
    setError(null);

    try {
      const updatedRecord = await action();
      setWorkflowRecord(updatedRecord);
      await loadRecords(tableReference, tableName, true);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update the operational row.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-4 space-y-4">
      {error ? (
        <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
        </div>
      ) : null}

      <IntakeSnapshotSection
        title="Shipping Snapshot"
        fields={[
          { label: 'Action Status', value: displayValue(actionStatus) },
          { label: 'Sold Ready', value: formatTimestamp(workflowRecord.fields['Sold Ready To Ship At']) },
          { label: 'Shipped', value: formatTimestamp(workflowRecord.fields['Shipped At']) },
          { label: 'Ship Notes Updated', value: formatTimestamp(workflowRecord.fields['Shipment Follow-Through Updated At']) },
          { label: 'Shipping Method', value: displayValue(workflowRecord.fields['Shipping Method']) },
          { label: 'Shipping Dims', value: displayValue(workflowRecord.fields['Shipping Dims']) },
          { label: 'Shipping Weight', value: displayValue(workflowRecord.fields.Weight) },
          { label: 'Manual', value: displayValue(workflowRecord.fields.Manual) },
          { label: 'Remote', value: displayValue(workflowRecord.fields.Remote) },
          { label: 'Power Cable', value: displayValue(workflowRecord.fields['Power Cable']) },
          { label: 'Additional Items', value: displayValue(workflowRecord.fields['Additional Items']) },
        ]}
        cards={[
          { title: 'Ship Notes', value: shipNotes, emptyValue: 'No ship notes available.' },
        ]}
      />

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--panel)]/60 px-4 py-4">
        <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Shipping Actions</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {actionOptions.length > 0 ? (
            <>
              <label className="flex min-w-[220px] flex-1">
                <span className="sr-only">Select a shipping action</span>
                <select
                  aria-label="Select a shipping action"
                  className="h-[42px] w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                  value={selectedAction}
                  onChange={(event) => setSelectedAction(event.currentTarget.value)}
                  disabled={saving}
                >
                  <option value="" disabled>Choose Action</option>
                  {actionOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className={`${primaryActionButtonClass} w-full`}
                onClick={() => {
                  const action = actionOptions.find((option) => option.value === selectedAction);
                  if (action) {
                    void runAction(action.run);
                  }
                }}
                disabled={saving || !selectedAction}
              >
                Saved
              </button>
            </>
          ) : (
            <span className="text-xs text-[var(--muted)]">No shipping actions available.</span>
          )}
        </div>
      </section>
    </section>
  );
}
