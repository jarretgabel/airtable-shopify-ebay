import { useEffect, useState } from 'react';
import { ErrorSurface, LoadingSurface, PanelSurface } from '@/components/app/StateSurfaces';
import {
  completePreListingReviewStage,
  completePhotographyStage,
  completeProcessingStage,
  completeTestingStage,
  loadUsedGearWorkflowRecord,
} from '@/services/usedGearQueue';
import { displayInventoryValue } from '@/services/inventoryDirectory';
import { getUsedGearWorkflowStatus } from '@/services/usedGearWorkflow';
import { getUsedGearWorkflowListingReadiness } from '@/services/usedGearWorkflowListingReadiness';
import type { AirtableRecord } from '@/types/airtable';

interface UsedGearWorkflowRecordPageProps {
  currentUserName: string;
  recordId: string;
  onBackToDirectory: () => void;
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

export function UsedGearWorkflowRecordPage({
  currentUserName,
  recordId,
  onBackToDirectory,
  onOpenIncomingGearForm,
  onOpenTestingForm,
  onOpenPhotosForm,
  onOpenListingsRecord,
  onOpenInventoryEditor,
}: UsedGearWorkflowRecordPageProps) {
  const [record, setRecord] = useState<AirtableRecord | null>(null);
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
        const nextRecord = await loadUsedGearWorkflowRecord(recordId);
        if (!cancelled) {
          setRecord(nextRecord);
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
  const canApproveForPublish = Boolean(
    statusSupportsPreListingReview(status)
      && readiness
      && readiness.missingRequirements.length === 0
      && pricingConfirmed
      && contentConfirmed,
  );

  useEffect(() => {
    setPricingConfirmed(false);
    setContentConfirmed(false);
  }, [recordId, status]);

  const runAction = async (action: () => Promise<AirtableRecord>) => {
    setSaving(true);
    setError(null);

    try {
      setRecord(await action());
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
                    void runAction(() => completeProcessingStage(recordId, currentUserName));
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
                      void runAction(() => completeTestingStage(recordId, currentUserName));
                    }}
                    disabled={saving || testingSigned}
                  >
                    {saving ? 'Saving...' : 'Mark Testing Complete'}
                  </button>
                  <button
                    type="button"
                    className="rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => {
                      void runAction(() => completePhotographyStage(recordId, currentUserName));
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
                  {readiness.missingRequirements[0]}
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