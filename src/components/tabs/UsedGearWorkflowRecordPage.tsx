import { useEffect, useState } from 'react';
import { ErrorSurface, LoadingSurface, PanelSurface } from '@/components/app/StateSurfaces';
import { useAuthStore } from '@/stores/auth/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import {
  completePreListingReviewStage,
  completePhotographyStage,
  completeProcessingStage,
  completeTestingStage,
  loadUsedGearWorkflowRecordContext,
} from '@/services/usedGearQueue';
import { displayInventoryValue } from '@/services/inventoryDirectory';
import { getUsedGearWorkflowStatus } from '@/services/usedGearWorkflow';
import {
  type UsedGearCompletedStage,
} from '@/services/usedGearWorkflowStageNotifications';
import {
  type UsedGearWorkflowListingReadinessActionTarget,
} from '@/services/usedGearWorkflowListingReadiness';
import { publishUsedGearStageHandoffNotification } from '@/services/usedGearWorkflowHandoffNotifier';
import { getUsedGearWorkflowListingReadiness } from '@/services/usedGearWorkflowListingReadiness';
import { buildUsedGearWorkflowTimeline } from '@/services/usedGearWorkflowTimeline';
import type { AirtableRecord } from '@/types/airtable';

interface UsedGearWorkflowRecordPageProps {
  currentUserName: string;
  recordId: string;
  onBackToDirectory: () => void;
  onOpenWorkflowRecord: (recordId: string) => void;
  onOpenIncomingGearForm: (recordId: string) => void;
  onOpenTestingForm: (recordId: string) => void;
  onOpenPhotosForm: (recordId: string) => void;
  onOpenListingsRecord: (recordId: string) => void;
  onOpenInventoryEditor: (recordId: string) => void;
}

function statusSupportsProcessingCompletion(status: string | null): boolean {
  return status === 'Accepted - Awaiting Arrival'
    || status === 'Accepted - Arrived, Awaiting SKU'
    || status === 'Accepted - Arrived, Awaiting Missing Item';
}

function statusSupportsPreListingReview(status: string | null): boolean {
  return status === 'Awaiting Pre-Listing Review';
}

function statusSupportsListingsApproval(status: string | null): boolean {
  return status === 'Approved for Publish';
}

function formatTimelineTimestamp(value: string | null): string {
  if (!value) {
    return 'Pending';
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return new Date(parsed).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function runReadinessAction(target: UsedGearWorkflowListingReadinessActionTarget, recordId: string, actions: {
  onOpenIncomingGearForm: (recordId: string) => void;
  onOpenTestingForm: (recordId: string) => void;
  onOpenPhotosForm: (recordId: string) => void;
  onOpenListingsRecord: (recordId: string) => void;
  onOpenInventoryEditor: (recordId: string) => void;
}) {
  if (target === 'incoming-gear') {
    actions.onOpenIncomingGearForm(recordId);
    return;
  }

  if (target === 'testing') {
    actions.onOpenTestingForm(recordId);
    return;
  }

  if (target === 'photos') {
    actions.onOpenPhotosForm(recordId);
    return;
  }

  if (target === 'listings-approval') {
    actions.onOpenListingsRecord(recordId);
    return;
  }

  actions.onOpenInventoryEditor(recordId);
}

export function UsedGearWorkflowRecordPage({
  currentUserName,
  recordId,
  onBackToDirectory,
  onOpenWorkflowRecord,
  onOpenIncomingGearForm,
  onOpenTestingForm,
  onOpenPhotosForm,
  onOpenListingsRecord,
  onOpenInventoryEditor,
}: UsedGearWorkflowRecordPageProps) {
  const currentUser = useAuthStore((state) => state.users.find((user) => user.id === state.currentUserId) ?? null);
  const upsertByKey = useNotificationStore((state) => state.upsertByKey);
  const [record, setRecord] = useState<AirtableRecord | null>(null);
  const [relatedGroupRecords, setRelatedGroupRecords] = useState<AirtableRecord[]>([]);
  const [relatedGroupLabel, setRelatedGroupLabel] = useState<string | null>(null);
  const [relatedGroupDescription, setRelatedGroupDescription] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pricingConfirmed, setPricingConfirmed] = useState(false);
  const [contentConfirmed, setContentConfirmed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadRecord = async () => {
      setLoading(true);
      setError(null);

      try {
        const nextContext = await loadUsedGearWorkflowRecordContext(recordId);
        if (!cancelled) {
          setRecord(nextContext.record);
          setRelatedGroupRecords(nextContext.group?.records.filter((candidate) => candidate.id !== recordId) ?? []);
          setRelatedGroupLabel(nextContext.group?.label ?? null);
          setRelatedGroupDescription(nextContext.group?.description ?? null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load the selected workflow record.');
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

  const status = record ? getUsedGearWorkflowStatus(record.fields) : null;
  const testingSigned = typeof record?.fields['Testing Signed By'] === 'string' && record.fields['Testing Signed By'].trim().length > 0;
  const photographySigned = typeof record?.fields['Photography Signed By'] === 'string' && record.fields['Photography Signed By'].trim().length > 0;
  const readiness = record ? getUsedGearWorkflowListingReadiness(record) : null;
  const timeline = record ? buildUsedGearWorkflowTimeline(record) : [];
  const canApproveForPublish = Boolean(
    statusSupportsPreListingReview(status)
      && readiness
      && readiness.missingRequirements.length === 0
      && pricingConfirmed
      && contentConfirmed,
  );
  const relatedGroupSummary = relatedGroupRecords.length > 0 ? {
    pricedCount: relatedGroupRecords.filter((candidate) => {
      const value = candidate.fields.Price;
      return typeof value === 'string' ? value.trim().length > 0 : typeof value === 'number';
    }).length,
    offerCount: relatedGroupRecords.filter((candidate) => {
      const value = candidate.fields['Offer Amount'];
      return typeof value === 'number' || (typeof value === 'string' && value.trim().length > 0);
    }).length,
  } : null;

  useEffect(() => {
    setPricingConfirmed(false);
    setContentConfirmed(false);
  }, [recordId, status]);

  const runAction = async (
    action: () => Promise<AirtableRecord>,
    completedStage?: UsedGearCompletedStage,
  ) => {
    setSaving(true);
    setError(null);

    try {
      const updatedRecord = await action();
      setRecord(updatedRecord);

      if (completedStage) {
        publishUsedGearStageHandoffNotification({
          completedStage,
          currentUser,
          record: updatedRecord,
          onOpenWorkflowRecord,
          upsertByKey,
        });
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update the workflow record.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !record) {
    return <LoadingSurface message="Loading used-gear workflow detail..." />;
  }

  if (error && !record) {
    return (
      <ErrorSurface title="Unable to load workflow record" message={error}>
        <div className="mt-4">
          <button
            type="button"
            className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            onClick={onBackToDirectory}
          >
            Back to Directory
          </button>
        </div>
      </ErrorSurface>
    );
  }

  return (
    <PanelSurface>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 px-5 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="m-0 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Used Gear Workflow</p>
              <h2 className="mt-2 text-3xl font-semibold text-[var(--ink)]">Workflow Detail</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">This record view focuses on workflow routing, grouped intake context, and operational handoff actions.</p>
            </div>

            <button
              type="button"
              className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              onClick={onBackToDirectory}
            >
              Back to Directory
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Record</p>
            <h3 className="mt-2 text-2xl font-semibold text-[var(--ink)]">{displayInventoryValue(record?.fields.SKU)}</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">{displayInventoryValue(record?.fields.Make)} · {displayInventoryValue(record?.fields.Model)}</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
                <div>Status</div>
                <div className="mt-1 text-base font-semibold text-[var(--ink)]">{displayInventoryValue(record?.fields['Workflow Status'])}</div>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
                <div>Next Team</div>
                <div className="mt-1 text-base font-semibold text-[var(--ink)]">{displayInventoryValue(record?.fields['Workflow Next Team'])}</div>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
                <div>Submission Group</div>
                <div className="mt-1 text-base font-semibold text-[var(--ink)]">{displayInventoryValue(record?.fields['Submission Group ID'])}</div>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
                <div>Pick Up</div>
                <div className="mt-1 text-base font-semibold text-[var(--ink)]">{displayInventoryValue(record?.fields['Pick Up ID'])}</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Actions</p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                onClick={() => onOpenIncomingGearForm(recordId)}
              >
                Open Incoming Gear
              </button>
              <button
                type="button"
                className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                onClick={() => onOpenTestingForm(recordId)}
              >
                Open Testing
              </button>
              <button
                type="button"
                className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                onClick={() => onOpenPhotosForm(recordId)}
              >
                Open Photos
              </button>
              <button
                type="button"
                className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                onClick={() => onOpenInventoryEditor(recordId)}
              >
                Open Full Editor
              </button>

              {statusSupportsListingsApproval(status) ? (
                <button
                  type="button"
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                  onClick={() => onOpenListingsRecord(recordId)}
                >
                  Open Listings Approval
                </button>
              ) : null}

              {statusSupportsProcessingCompletion(status) ? (
                <button
                  type="button"
                  className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => {
                    void runAction(() => completeProcessingStage(recordId, currentUserName), 'processing');
                  }}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Complete Processing'}
                </button>
              ) : null}

              {status === 'Testing and Photography In Progress' ? (
                <>
                  <button
                    type="button"
                    className="rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => {
                      void runAction(() => completeTestingStage(recordId, currentUserName), 'testing');
                    }}
                    disabled={saving || testingSigned}
                  >
                    {saving ? 'Saving...' : 'Mark Testing Complete'}
                  </button>
                  <button
                    type="button"
                    className="rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => {
                      void runAction(() => completePhotographyStage(recordId, currentUserName), 'photography');
                    }}
                    disabled={saving || photographySigned}
                  >
                    {saving ? 'Saving...' : 'Mark Photography Complete'}
                  </button>
                </>
              ) : null}

            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Pre-Listing Readiness</p>
              <h3 className="mt-2 text-xl font-semibold text-[var(--ink)]">Reviewer And Pricing Gate</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Review the listing-critical fields gathered through intake, testing, photography, and prefill before promoting this row to publish-ready status.
              </p>
            </div>
            <div className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              {statusSupportsPreListingReview(status) ? 'Awaiting reviewer confirmation' : displayInventoryValue(record?.fields['Workflow Status'])}
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
              <div>Listing Title</div>
              <div className="mt-1 text-base font-semibold text-[var(--ink)]">{readiness?.title || 'Not ready'}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.08em]">{readiness?.titleFieldName || 'Derived from workflow data'}</div>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
              <div>Listing Price</div>
              <div className="mt-1 text-base font-semibold text-[var(--ink)]">{readiness?.price || 'Missing price'}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.08em]">{readiness?.priceFieldName || 'No price field found'}</div>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
              <div>Listing Description</div>
              <div className="mt-1 text-sm leading-6 text-[var(--ink)]">{readiness?.description || 'No listing description yet.'}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.08em]">{readiness?.descriptionFieldName || 'Derived from inventory notes'}</div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4 text-sm text-[var(--muted)]">
              <h4 className="m-0 text-base font-semibold text-[var(--ink)]">Stage Context</h4>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>Processing Signed By: {displayInventoryValue(record?.fields['Processing Signed By'])}</div>
                <div>Testing Signed By: {displayInventoryValue(record?.fields['Testing Signed By'])}</div>
                <div>Photography Signed By: {displayInventoryValue(record?.fields['Photography Signed By'])}</div>
                <div>Pre-Listing Reviewed By: {displayInventoryValue(record?.fields['Pre-Listing Reviewed By'])}</div>
                <div>Inventory Notes: {displayInventoryValue(record?.fields['Inventory Notes'])}</div>
                <div>Internal Inclusion Notes: {displayInventoryValue(record?.fields['Internal Inclusion Notes'])}</div>
                <div>Internal Cosmetic Notes: {displayInventoryValue(record?.fields['Internal Cosmetic Notes'])}</div>
                <div>Internal Functional Notes: {displayInventoryValue(record?.fields['Internal Functional Notes'])}</div>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4 text-sm text-[var(--muted)]">
              <h4 className="m-0 text-base font-semibold text-[var(--ink)]">Reviewer Checklist</h4>

              {readiness && readiness.missingRequirements.length > 0 ? (
                <div className="mt-3 rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-3 text-amber-200">
                  <p className="m-0">{readiness.missingRequirements[0]}</p>
                  {readiness.blockers[0] ? (
                    <button
                      type="button"
                      className="mt-3 rounded-xl border border-amber-300/50 bg-amber-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-amber-100 transition hover:border-amber-200 hover:text-white"
                      onClick={() => runReadinessAction(readiness.blockers[0].actionTarget, recordId, {
                        onOpenIncomingGearForm,
                        onOpenTestingForm,
                        onOpenPhotosForm,
                        onOpenListingsRecord,
                        onOpenInventoryEditor,
                      })}
                    >
                      {readiness.blockers[0].actionLabel}
                    </button>
                  ) : null}
                </div>
              ) : null}

              <label className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={pricingConfirmed}
                  onChange={(event) => setPricingConfirmed(event.currentTarget.checked)}
                  disabled={!statusSupportsPreListingReview(status) || saving}
                />
                <span>
                  <span className="block font-semibold text-[var(--ink)]">Pricing confirmed</span>
                  <span className="block text-xs leading-5">I verified the current listing price and it is ready to hand off to listing approval.</span>
                </span>
              </label>

              <label className="mt-3 flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={contentConfirmed}
                  onChange={(event) => setContentConfirmed(event.currentTarget.checked)}
                  disabled={!statusSupportsPreListingReview(status) || saving}
                />
                <span>
                  <span className="block font-semibold text-[var(--ink)]">Content reviewed</span>
                  <span className="block text-xs leading-5">I reviewed the derived title, description, notes, and stage signoffs before approving this row for publish.</span>
                </span>
              </label>

              {statusSupportsPreListingReview(status) ? (
                <button
                  type="button"
                  className="mt-4 w-full rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => {
                    void runAction(() => completePreListingReviewStage(recordId, currentUserName));
                  }}
                  disabled={!canApproveForPublish || saving}
                >
                  {saving ? 'Saving...' : 'Approve For Publish'}
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {relatedGroupRecords.length > 0 ? (
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5 lg:col-span-2">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="m-0 text-xl font-semibold text-[var(--ink)]">Grouped Submission Context</h3>
                  <p className="mt-2 text-sm text-[var(--muted)]">This row shares a {relatedGroupDescription?.toLowerCase() ?? 'workflow group'} with {relatedGroupRecords.length} other row{relatedGroupRecords.length === 1 ? '' : 's'} under {relatedGroupLabel}.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    Sibling rows: {relatedGroupRecords.length}
                  </div>
                  <div className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    Siblings with offers: {relatedGroupSummary?.offerCount ?? 0}
                  </div>
                  <div className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                    Siblings with price: {relatedGroupSummary?.pricedCount ?? 0}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {relatedGroupRecords.map((candidate) => (
                  <div key={candidate.id} className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-[var(--ink)]">{displayInventoryValue(candidate.fields.SKU)}</div>
                        <div className="mt-1">{displayInventoryValue(candidate.fields.Make)} · {displayInventoryValue(candidate.fields.Model)}</div>
                      </div>
                      <div className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                        {displayInventoryValue(candidate.fields['Workflow Status'])}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-1 sm:grid-cols-2">
                      <div>Offer Amount: {displayInventoryValue(candidate.fields['Offer Amount'])}</div>
                      <div>Paid Amount: {displayInventoryValue(candidate.fields['Paid Amount'])}</div>
                      <div>Group Total: {displayInventoryValue(candidate.fields['Confirmed Grand Total'])}</div>
                      <div>Accepted By: {displayInventoryValue(candidate.fields['Accepted By'])}</div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                        onClick={() => onOpenWorkflowRecord(candidate.id)}
                      >
                        Open Sibling Workflow
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
            <h3 className="m-0 text-xl font-semibold text-[var(--ink)]">Workflow Timeline</h3>
            <div className="mt-4 space-y-3">
              {timeline.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
                  <div className={[
                    'mt-0.5 h-2.5 w-2.5 rounded-full',
                    entry.status === 'completed' ? 'bg-emerald-400' : 'bg-[var(--line)]',
                  ].join(' ')} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[var(--ink)]">{entry.label}</span>
                      <span className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                        {entry.status === 'completed' ? 'Completed' : 'Pending'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted)]">{formatTimelineTimestamp(entry.timestamp)}</p>
                    {entry.actor ? (
                      <p className="m-0 text-xs uppercase tracking-[0.08em] text-[var(--muted)]">By {entry.actor}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
            <h3 className="m-0 text-xl font-semibold text-[var(--ink)]">Workflow Audit</h3>
            <div className="mt-4 space-y-2 text-sm text-[var(--muted)]">
              <div>Accepted By: {displayInventoryValue(record?.fields['Accepted By'])}</div>
              <div>Accepted At: {displayInventoryValue(record?.fields['Accepted At'])}</div>
              <div>Processing Signed By: {displayInventoryValue(record?.fields['Processing Signed By'])}</div>
              <div>Testing Signed By: {displayInventoryValue(record?.fields['Testing Signed By'])}</div>
              <div>Photography Signed By: {displayInventoryValue(record?.fields['Photography Signed By'])}</div>
              <div>Pre-Listing Reviewed By: {displayInventoryValue(record?.fields['Pre-Listing Reviewed By'])}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
            <h3 className="m-0 text-xl font-semibold text-[var(--ink)]">Reference Notes</h3>
            <div className="mt-4 space-y-2 text-sm text-[var(--muted)]">
              <div>Qualification Notes: {displayInventoryValue(record?.fields['Qualification Notes'])}</div>
              <div>Customer Cosmetic Notes: {displayInventoryValue(record?.fields['Customer Cosmetic Notes'])}</div>
              <div>Customer Functional Notes: {displayInventoryValue(record?.fields['Customer Functional Notes'])}</div>
              <div>Internal Cosmetic Notes: {displayInventoryValue(record?.fields['Internal Cosmetic Notes'])}</div>
              <div>Internal Functional Notes: {displayInventoryValue(record?.fields['Internal Functional Notes'])}</div>
              <div>Inventory Notes: {displayInventoryValue(record?.fields['Inventory Notes'])}</div>
            </div>
          </div>
        </section>
      </div>
    </PanelSurface>
  );
}