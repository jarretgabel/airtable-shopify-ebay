import { useEffect, useMemo, useState } from 'react';
import {
  markWorkflowListingStale,
  markWorkflowRelisted,
  markWorkflowShipped,
  markWorkflowSoldReadyToShip,
  loadUsedGearOperationalRecordContext,
  saveWorkflowShipmentFollowThrough,
  saveWorkflowStaleRecovery,
} from '@/services/usedGearQueue';
import {
  getUsedGearWorkflowPostPublishSnapshot,
  USED_GEAR_STALE_RECOVERY_STATUS_OPTIONS,
  type UsedGearWorkflowStaleRecoveryStatus,
} from '@/services/usedGearWorkflowLifecycle';
import { applyUsedGearWorkflowNoteTemplate, getUsedGearWorkflowNoteTemplates } from '@/services/usedGearWorkflowNoteTemplates';
import { displayValue } from '@/stores/approvalStore';
import type { AirtableRecord } from '@/types/airtable';

interface ListingApprovalWorkflowOpsPanelProps {
  selectedRecord: AirtableRecord;
  tableReference: string;
  tableName?: string;
  loadRecords: (tableReference: string, tableName?: string, force?: boolean) => Promise<void>;
  onOpenOperationalRecord?: (recordId: string) => void;
}

const STAGE_CONTEXT_FIELDS = [
  { label: 'Processing Signed By', fieldName: 'Processing Signed By' },
  { label: 'Processing Signed At', fieldName: 'Processing Signed At' },
  { label: 'Testing Signed By', fieldName: 'Testing Signed By' },
  { label: 'Testing Signed At', fieldName: 'Testing Signed At' },
  { label: 'Photography Signed By', fieldName: 'Photography Signed By' },
  { label: 'Photography Signed At', fieldName: 'Photography Signed At' },
  { label: 'Pre-Listing Reviewed By', fieldName: 'Pre-Listing Reviewed By' },
  { label: 'Pre-Listing Reviewed At', fieldName: 'Pre-Listing Reviewed At' },
  { label: 'Inventory Notes', fieldName: 'Inventory Notes' },
  { label: 'Testing Cosmetic Notes', fieldName: 'Testing Cosmetic Notes' },
  { label: 'Photography Cosmetic Notes', fieldName: 'Photography Cosmetic Notes' },
  { label: 'Internal Inclusion Notes', fieldName: 'Internal Inclusion Notes' },
  { label: 'Internal Cosmetic Notes', fieldName: 'Internal Cosmetic Notes' },
  { label: 'Internal Functional Notes', fieldName: 'Internal Functional Notes' },
] as const;

const WORKFLOW_AUDIT_FIELDS = [
  { label: 'Workflow Source', fieldName: 'Workflow Source' },
  { label: 'Trash Status', fieldName: 'Trash Status' },
  { label: 'Workflow Owner', fieldName: 'Workflow Owner' },
  { label: 'Workflow Owner Assigned At', fieldName: 'Workflow Owner Assigned At' },
  { label: 'Accepted By', fieldName: 'Accepted By' },
  { label: 'Accepted At', fieldName: 'Accepted At' },
  { label: 'Qualification Complete', fieldName: 'Qualification Complete' },
  { label: 'Allocation Mode', fieldName: 'Allocation Mode' },
  { label: 'Allocation Notes', fieldName: 'Allocation Notes' },
  { label: 'Offer Amount', fieldName: 'Offer Amount' },
  { label: 'Paid Amount', fieldName: 'Paid Amount' },
  { label: 'Confirmed Grand Total', fieldName: 'Confirmed Grand Total' },
  { label: 'Awaiting Pre-Listing Review At', fieldName: 'Awaiting Pre-Listing Review At' },
  { label: 'Approved For Publish At', fieldName: 'Approved For Publish At' },
  { label: 'Listed At', fieldName: 'Listed At' },
  { label: 'eBay Published At', fieldName: 'eBay Published At' },
  { label: 'eBay Offer ID', fieldName: 'eBay Offer ID' },
  { label: 'eBay Listing ID', fieldName: 'eBay Listing ID' },
  { label: 'Stale Listing At', fieldName: 'Stale Listing At' },
  { label: 'Sold Ready To Ship At', fieldName: 'Sold Ready To Ship At' },
  { label: 'Shipment Follow-Through Updated At', fieldName: 'Shipment Follow-Through Updated At' },
  { label: 'Shipped At', fieldName: 'Shipped At' },
] as const;

const REFERENCE_NOTE_FIELDS = [
  { label: 'Qualification Notes', fieldName: 'Qualification Notes' },
  { label: 'Unqualified Reason', fieldName: 'Unqualified Reason' },
  { label: 'Customer Cosmetic Notes', fieldName: 'Customer Cosmetic Notes' },
  { label: 'Customer Functional Notes', fieldName: 'Customer Functional Notes' },
  { label: 'Customer Inclusion Notes', fieldName: 'Customer Inclusion Notes' },
  { label: 'Customer Submitted Photos Notes', fieldName: 'Customer Submitted Photos Notes' },
  { label: 'Testing Cosmetic Notes', fieldName: 'Testing Cosmetic Notes' },
  { label: 'Photography Cosmetic Notes', fieldName: 'Photography Cosmetic Notes' },
  { label: 'Internal Cosmetic Notes', fieldName: 'Internal Cosmetic Notes' },
  { label: 'Internal Functional Notes', fieldName: 'Internal Functional Notes' },
  { label: 'Internal Inclusion Notes', fieldName: 'Internal Inclusion Notes' },
  { label: 'Inventory Notes', fieldName: 'Inventory Notes' },
  { label: 'Shipment Follow-Through Notes', fieldName: 'Shipment Follow-Through Notes' },
] as const;

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
          className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
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
  onOpenOperationalRecord,
}: ListingApprovalWorkflowOpsPanelProps) {
  const [workflowRecord, setWorkflowRecord] = useState(selectedRecord);
  const [relatedGroupRecords, setRelatedGroupRecords] = useState<AirtableRecord[]>([]);
  const [relatedGroupLabel, setRelatedGroupLabel] = useState<string | null>(null);
  const [relatedGroupDescription, setRelatedGroupDescription] = useState<string | null>(null);
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
        setRelatedGroupRecords(nextContext.group?.records.filter((candidate) => candidate.id !== selectedRecord.id) ?? []);
        setRelatedGroupLabel(nextContext.group?.label ?? null);
        setRelatedGroupDescription(nextContext.group?.description ?? null);
      } catch {
        if (!cancelled) {
          setRelatedGroupRecords([]);
          setRelatedGroupLabel(null);
          setRelatedGroupDescription(null);
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
  const relatedGroupSummary = useMemo(() => ({
    pricedCount: relatedGroupRecords.filter((candidate) => {
      const value = candidate.fields.Price;
      return typeof value === 'number' || (typeof value === 'string' && value.trim().length > 0);
    }).length,
    offerCount: relatedGroupRecords.filter((candidate) => {
      const value = candidate.fields['Offer Amount'];
      return typeof value === 'number' || (typeof value === 'string' && value.trim().length > 0);
    }).length,
  }), [relatedGroupRecords]);

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
        <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
        </div>
      ) : null}

      <details className="rounded-2xl border border-[var(--line)] bg-white/5" open>
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[var(--ink)]">Workflow Audit And Notes</summary>
        <div className="space-y-4 border-t border-[var(--line)] px-4 py-4 text-sm text-[var(--muted)]">
          <div className="grid gap-4 xl:grid-cols-3">
            <details className="rounded-xl border border-[var(--line)] bg-[var(--panel)]/60 px-4 py-3" open>
              <summary className="cursor-pointer text-sm font-semibold text-[var(--ink)]">Stage Context</summary>
              <div className="mt-3 space-y-2">
                {STAGE_CONTEXT_FIELDS.map((field) => (
                  <div key={field.fieldName}>{field.label}: {displayValue(workflowRecord.fields[field.fieldName])}</div>
                ))}
              </div>
            </details>

            <details className="rounded-xl border border-[var(--line)] bg-[var(--panel)]/60 px-4 py-3" open>
              <summary className="cursor-pointer text-sm font-semibold text-[var(--ink)]">Workflow Audit</summary>
              <div className="mt-3 space-y-2">
                {WORKFLOW_AUDIT_FIELDS.map((field) => (
                  <div key={field.fieldName}>{field.label}: {displayValue(workflowRecord.fields[field.fieldName])}</div>
                ))}
              </div>
            </details>

            <details className="rounded-xl border border-[var(--line)] bg-[var(--panel)]/60 px-4 py-3" open>
              <summary className="cursor-pointer text-sm font-semibold text-[var(--ink)]">Reference Notes</summary>
              <div className="mt-3 space-y-2">
                {REFERENCE_NOTE_FIELDS.map((field) => (
                  <div key={field.fieldName}>{field.label}: {displayValue(workflowRecord.fields[field.fieldName])}</div>
                ))}
              </div>
            </details>
          </div>

          {relatedGroupRecords.length > 0 ? (
            <details className="rounded-xl border border-[var(--line)] bg-[var(--panel)]/60 px-4 py-3" open>
              <summary className="cursor-pointer text-sm font-semibold text-[var(--ink)]">Grouped Submission Context</summary>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                <span className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1">Sibling rows: {relatedGroupRecords.length}</span>
                <span className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1">Siblings with offers: {relatedGroupSummary.offerCount}</span>
                <span className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1">Siblings with price: {relatedGroupSummary.pricedCount}</span>
              </div>
              <p className="mb-0 mt-3">
                This row shares a {relatedGroupDescription?.toLowerCase() ?? 'workflow group'} with {relatedGroupRecords.length} other row{relatedGroupRecords.length === 1 ? '' : 's'} under {relatedGroupLabel}.
              </p>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {relatedGroupRecords.map((candidate) => (
                  <div key={candidate.id} className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-[var(--ink)]">{displayValue(candidate.fields.SKU)}</div>
                        <div className="mt-1">{displayValue(candidate.fields.Make)} · {displayValue(candidate.fields.Model)}</div>
                      </div>
                      <div className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                        {displayValue(candidate.fields['Workflow Status'])}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-1 sm:grid-cols-2">
                      <div>Offer Amount: {displayValue(candidate.fields['Offer Amount'])}</div>
                      <div>Paid Amount: {displayValue(candidate.fields['Paid Amount'])}</div>
                      <div>Group Total: {displayValue(candidate.fields['Confirmed Grand Total'])}</div>
                      <div>Accepted By: {displayValue(candidate.fields['Accepted By'])}</div>
                    </div>
                    {onOpenOperationalRecord ? (
                      <div className="mt-3">
                        <button
                          type="button"
                          className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                          onClick={() => onOpenOperationalRecord(candidate.id)}
                        >
                          Open Sibling Operational Record
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      </details>

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
                      className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
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
                      className="min-h-24 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
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
                    className="min-h-24 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
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
                    <button
                      type="button"
                      className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => {
                        void runAction(() => markWorkflowShipped(selectedRecord.id));
                      }}
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : 'Mark Shipped'}
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
              {postPublishSnapshot?.bucket === 'active-listing' || postPublishSnapshot?.bucket === 'stale-listing' ? (
                <button
                  type="button"
                  className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => {
                    void runAction(() => markWorkflowSoldReadyToShip(selectedRecord.id));
                  }}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Mark Sold Ready'}
                </button>
              ) : null}
            </div>
          </div>
        </details>
      ) : null}
    </section>
  );
}