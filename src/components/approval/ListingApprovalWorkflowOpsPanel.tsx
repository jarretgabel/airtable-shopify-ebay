import { useEffect, useMemo, useState } from 'react';
import {
  markWorkflowListingStale,
  markWorkflowRelisted,
  markWorkflowCancelled,
  markWorkflowPartialRefund,
  markWorkflowRefunded,
  markWorkflowReturnReceived,
  markWorkflowShipped,
  markWorkflowSoldReadyToShip,
  loadUsedGearOperationalRecordContext,
  resolveWorkflowRestockDisposition,
  saveWorkflowShipmentFollowThrough,
  saveWorkflowStaleRecovery,
} from '@/services/usedGearQueue';
import {
  getUsedGearWorkflowPostPublishSnapshot,
  USED_GEAR_STALE_RECOVERY_STATUS_OPTIONS,
  type UsedGearWorkflowStaleRecoveryStatus,
} from '@/services/usedGearWorkflowLifecycle';
import { applyUsedGearWorkflowNoteTemplate, getUsedGearWorkflowNoteTemplates } from '@/services/usedGearWorkflowNoteTemplates';
import { compactRowPrimaryActionButtonClass, compactRowSecondaryActionButtonClass } from '@/components/app/buttonStyles';
import {
  tabFormControlBaseClass,
  tabFormControlMultilineClass,
  tabTemplatePillClass,
  warningInlineBannerClass,
} from '@/components/tabs/uiClasses';
import { displayValue } from '@/stores/approvalStore';
import type { AirtableRecord } from '@/types/airtable';

interface ListingApprovalWorkflowOpsPanelProps {
  selectedRecord: AirtableRecord;
  tableReference: string;
  tableName?: string;
  loadRecords: (tableReference: string, tableName?: string, force?: boolean) => Promise<void>;
}

function normalizeStaleRecoveryStatus(value: unknown): UsedGearWorkflowStaleRecoveryStatus | '' {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return USED_GEAR_STALE_RECOVERY_STATUS_OPTIONS.includes(normalized as UsedGearWorkflowStaleRecoveryStatus)
    ? normalized as UsedGearWorkflowStaleRecoveryStatus
    : '';
}

function hasPostPublishStatus(status: unknown): boolean {
  return typeof status === 'string'
    && (
      status === 'Listed, Shopify'
      || status === 'Listed, eBay'
      || status === 'Stale Listing, Shopify'
      || status === 'Stale Listing, eBay'
      || status === 'Sold - Ready to Ship'
      || status === 'Shipped'
    );
}

function NoteTemplateRow({
  label,
  templateType,
  onApplyTemplate,
}: {
  label: string;
  templateType: 'stale-recovery' | 'shipment-follow-through';
  onApplyTemplate: (templateValue: string) => void;
}) {
  const templates = getUsedGearWorkflowNoteTemplates(templateType);

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <span className="self-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]/80">{label}</span>
      {templates.map((template) => (
        <button
          key={template.id}
          type="button"
          className={tabTemplatePillClass}
          onClick={() => onApplyTemplate(template.value)}
        >
          {template.label}
        </button>
      ))}
    </div>
  );
}

export function ListingApprovalWorkflowOpsPanel({
  selectedRecord,
  tableReference,
  tableName,
  loadRecords,
}: ListingApprovalWorkflowOpsPanelProps) {
  const [workflowRecord, setWorkflowRecord] = useState(selectedRecord);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staleRecoveryDraftStatus, setStaleRecoveryDraftStatus] = useState<UsedGearWorkflowStaleRecoveryStatus | ''>('');
  const [staleRecoveryDraftNotes, setStaleRecoveryDraftNotes] = useState('');
  const [shipmentFollowThroughDraftNotes, setShipmentFollowThroughDraftNotes] = useState('');

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

  const staleRecoveryStatus = typeof workflowRecord.fields['Stale Recovery Status'] === 'string' ? workflowRecord.fields['Stale Recovery Status'] : '';
  const staleRecoveryNotes = typeof workflowRecord.fields['Stale Recovery Notes'] === 'string' ? workflowRecord.fields['Stale Recovery Notes'] : '';
  const shipmentFollowThroughNotes = typeof workflowRecord.fields['Shipment Follow-Through Notes'] === 'string' ? workflowRecord.fields['Shipment Follow-Through Notes'] : '';
  const shipmentFollowThroughUpdatedAt = typeof workflowRecord.fields['Shipment Follow-Through Updated At'] === 'string'
    ? workflowRecord.fields['Shipment Follow-Through Updated At']
    : '';
  const postPublishSnapshot = useMemo(() => getUsedGearWorkflowPostPublishSnapshot(workflowRecord), [workflowRecord]);
  const showMarkSoldReady = postPublishSnapshot?.bucket === 'active-listing' || postPublishSnapshot?.bucket === 'stale-listing';
  const showMarkShipped = postPublishSnapshot?.status === 'Sold - Ready to Ship';
  const noOutcomeYet = !postPublishSnapshot?.postSaleOutcome;
  const showMarkCancelled = (postPublishSnapshot?.bucket === 'sold-ready' || postPublishSnapshot?.bucket === 'shipped') && noOutcomeYet;
  const showMarkPartialRefund = (postPublishSnapshot?.bucket === 'sold-ready' || postPublishSnapshot?.bucket === 'shipped') && noOutcomeYet;
  const showMarkRefunded = (postPublishSnapshot?.bucket === 'sold-ready' || postPublishSnapshot?.bucket === 'shipped') && noOutcomeYet;
  const showMarkReturnReceived = postPublishSnapshot?.status === 'Shipped' && noOutcomeYet;
  const showDispositionActions = Boolean(postPublishSnapshot?.postSaleOutcome) && !postPublishSnapshot?.restockDisposition;
  useEffect(() => {
    setStaleRecoveryDraftStatus(normalizeStaleRecoveryStatus(staleRecoveryStatus));
    setStaleRecoveryDraftNotes(staleRecoveryNotes);
  }, [staleRecoveryNotes, staleRecoveryStatus, workflowRecord.id]);

  useEffect(() => {
    setShipmentFollowThroughDraftNotes(shipmentFollowThroughNotes);
  }, [shipmentFollowThroughNotes, workflowRecord.id]);

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
        <div className={warningInlineBannerClass}>
          {error}
        </div>
      ) : null}

      {postPublishSnapshot || hasPostPublishStatus(workflowRecord.fields['Workflow Status']) ? (
        <details className="rounded-2xl border border-[var(--line)] bg-white/5" open>
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[var(--ink)]">Post-Publish Lifecycle</summary>
          <div className="space-y-4 border-t border-[var(--line)] px-4 py-4 text-sm text-[var(--muted)]">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)]/60 px-4 py-3">
                <div>Lifecycle Status</div>
                <div className="mt-1 text-base font-semibold text-[var(--ink)]">{displayValue(workflowRecord.fields['Workflow Status'])}</div>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)]/60 px-4 py-3">
                <div>Listed At</div>
                <div className="mt-1 text-base font-semibold text-[var(--ink)]">{displayValue(workflowRecord.fields['Listed At'])}</div>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)]/60 px-4 py-3">
                <div>Sold Ready</div>
                <div className="mt-1 text-base font-semibold text-[var(--ink)]">{displayValue(workflowRecord.fields['Sold Ready To Ship At'])}</div>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)]/60 px-4 py-3">
                <div>Shipped</div>
                <div className="mt-1 text-base font-semibold text-[var(--ink)]">{displayValue(workflowRecord.fields['Shipped At'])}</div>
              </div>
            </div>

            {postPublishSnapshot?.status === 'Stale Listing, Shopify' || postPublishSnapshot?.status === 'Stale Listing, eBay' ? (
              <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)]/60 px-4 py-4">
                <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Stale Recovery Review</p>
                <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.3fr)]">
                  <label>
                    <span className="sr-only">Stale recovery status</span>
                    <select
                      className={tabFormControlBaseClass}
                      value={staleRecoveryDraftStatus}
                      onChange={(event) => setStaleRecoveryDraftStatus(normalizeStaleRecoveryStatus(event.currentTarget.value))}
                      disabled={saving}
                    >
                      <option value="">Recovery Status</option>
                      {USED_GEAR_STALE_RECOVERY_STATUS_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="sr-only">Stale recovery notes</span>
                    <textarea
                      className={tabFormControlMultilineClass}
                      value={staleRecoveryDraftNotes}
                      onChange={(event) => setStaleRecoveryDraftNotes(event.currentTarget.value)}
                      placeholder="Add relist, pricing, or content-refresh notes"
                      disabled={saving}
                    />
                  </label>
                </div>
                <NoteTemplateRow
                  label="Recovery templates"
                  templateType="stale-recovery"
                  onApplyTemplate={(templateValue) => {
                    setStaleRecoveryDraftNotes((currentValue) => applyUsedGearWorkflowNoteTemplate(currentValue, templateValue));
                  }}
                />
                <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--line)]/70 pt-4">
                  <button
                    type="button"
                    className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => {
                      void runAction(() => saveWorkflowStaleRecovery(selectedRecord.id, {
                        staleRecoveryStatus: staleRecoveryDraftStatus || null,
                        staleRecoveryNotes: staleRecoveryDraftNotes || null,
                      }));
                    }}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Recovery'}
                  </button>
                  <button
                    type="button"
                    className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => {
                      void runAction(() => markWorkflowRelisted(selectedRecord.id));
                    }}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Mark Relisted'}
                  </button>
                </div>
              </div>
            ) : null}

            {postPublishSnapshot?.status === 'Sold - Ready to Ship' || postPublishSnapshot?.status === 'Shipped' ? (
              <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)]/60 px-4 py-4">
                <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Shipment Follow-Through</p>
                <label className="mt-4 block">
                  <span className="sr-only">Shipment follow-through notes</span>
                  <textarea
                    className={tabFormControlMultilineClass}
                    value={shipmentFollowThroughDraftNotes}
                    onChange={(event) => setShipmentFollowThroughDraftNotes(event.currentTarget.value)}
                    placeholder="Add packing, carrier, or shipment confirmation notes"
                    disabled={saving || postPublishSnapshot.status === 'Shipped'}
                  />
                </label>
                {postPublishSnapshot.status === 'Sold - Ready to Ship' ? (
                  <NoteTemplateRow
                    label="Shipment templates"
                    templateType="shipment-follow-through"
                    onApplyTemplate={(templateValue) => {
                      setShipmentFollowThroughDraftNotes((currentValue) => applyUsedGearWorkflowNoteTemplate(currentValue, templateValue));
                    }}
                  />
                ) : null}
                {shipmentFollowThroughUpdatedAt ? (
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    Last updated {shipmentFollowThroughUpdatedAt}
                  </p>
                ) : null}
                {postPublishSnapshot.status === 'Sold - Ready to Ship' ? (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--line)]/70 pt-4">
                    <button
                      type="button"
                      className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => {
                        void runAction(() => saveWorkflowShipmentFollowThrough(selectedRecord.id, {
                          shipmentFollowThroughNotes: shipmentFollowThroughDraftNotes || null,
                        }));
                      }}
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : 'Save Shipment Notes'}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 border-t border-[var(--line)]/70 pt-4">
              {postPublishSnapshot?.status === 'Listed, Shopify' || postPublishSnapshot?.status === 'Listed, eBay' ? (
                <button
                  type="button"
                  className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => {
                    void runAction(() => markWorkflowListingStale(selectedRecord.id));
                  }}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Mark Stale'}
                </button>
              ) : null}
            </div>
            {postPublishSnapshot ? (
              <div className="flex flex-wrap gap-2 border-t border-[var(--line)]/70 pt-4">
                {showMarkSoldReady ? (
                  <button
                    type="button"
                    className={compactRowPrimaryActionButtonClass}
                    onClick={() => {
                      void runAction(() => markWorkflowSoldReadyToShip(selectedRecord.id));
                    }}
                    disabled={saving}
                  >
                    Sold Ready
                  </button>
                ) : null}
                {showMarkShipped ? (
                  <button
                    type="button"
                    className={compactRowPrimaryActionButtonClass}
                    onClick={() => {
                      void runAction(() => markWorkflowShipped(selectedRecord.id));
                    }}
                    disabled={saving}
                  >
                    Shipped
                  </button>
                ) : null}
                {showMarkCancelled ? (
                  <button
                    type="button"
                    className={compactRowSecondaryActionButtonClass}
                    onClick={() => {
                      void runAction(() => markWorkflowCancelled(selectedRecord.id));
                    }}
                    disabled={saving}
                  >
                    Cancelled
                  </button>
                ) : null}
                {showMarkPartialRefund ? (
                  <button
                    type="button"
                    className={compactRowSecondaryActionButtonClass}
                    onClick={() => {
                      void runAction(() => markWorkflowPartialRefund(selectedRecord.id));
                    }}
                    disabled={saving}
                  >
                    Partial Refund
                  </button>
                ) : null}
                {showMarkRefunded ? (
                  <button
                    type="button"
                    className={compactRowSecondaryActionButtonClass}
                    onClick={() => {
                      void runAction(() => markWorkflowRefunded(selectedRecord.id));
                    }}
                    disabled={saving}
                  >
                    Refunded
                  </button>
                ) : null}
                {showMarkReturnReceived ? (
                  <button
                    type="button"
                    className={compactRowSecondaryActionButtonClass}
                    onClick={() => {
                      void runAction(() => markWorkflowReturnReceived(selectedRecord.id));
                    }}
                    disabled={saving}
                  >
                    Return Received
                  </button>
                ) : null}
                {showDispositionActions ? (
                  <>
                    <button
                      type="button"
                      className={compactRowSecondaryActionButtonClass}
                      onClick={() => {
                        void runAction(() => resolveWorkflowRestockDisposition(selectedRecord.id, { restockDisposition: 'Relist Candidate' }));
                      }}
                      disabled={saving}
                    >
                      Relist Candidate
                    </button>
                    <button
                      type="button"
                      className={compactRowSecondaryActionButtonClass}
                      onClick={() => {
                        void runAction(() => resolveWorkflowRestockDisposition(selectedRecord.id, { restockDisposition: 'Needs Re-Intake' }));
                      }}
                      disabled={saving}
                    >
                      Needs Re-Intake
                    </button>
                    <button
                      type="button"
                      className={compactRowSecondaryActionButtonClass}
                      onClick={() => {
                        void runAction(() => resolveWorkflowRestockDisposition(selectedRecord.id, { restockDisposition: 'Parts / Damaged' }));
                      }}
                      disabled={saving}
                    >
                      Parts / Damaged
                    </button>
                    <button
                      type="button"
                      className={compactRowSecondaryActionButtonClass}
                      onClick={() => {
                        void runAction(() => resolveWorkflowRestockDisposition(selectedRecord.id, { restockDisposition: 'Archive Only' }));
                      }}
                      disabled={saving}
                    >
                      Archive Only
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </section>
  );
}