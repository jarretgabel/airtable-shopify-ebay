import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CollapsibleHelperText } from '@/components/app/CollapsibleHelperText';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import { smallSecondaryActionButtonClass } from '@/components/app/buttonStyles';
import { ErrorSurface, LoadingSurface, PanelSurface } from '@/components/app/StateSurfaces';
import {
  acceptPendingReviewRecord,
  hasUsedGearPendingReviewPricingPath,
  loadUsedGearOperationalRecordContext,
  markPendingReviewUnqualified,
  type UsedGearPendingReviewAcceptedStatus,
  type UsedGearOperationalRecordContext,
} from '@/services/usedGearQueue';
import { displayInventoryValue } from '@/services/inventoryDirectory';
import { applyUsedGearWorkflowNoteTemplate, getUsedGearWorkflowNoteTemplates } from '@/services/usedGearWorkflowNoteTemplates';

interface UsedGearPendingReviewRecordPageProps {
  currentUserName: string;
  recordId: string;
  onOpenManualIntake: (recordId: string) => void;
}

const ACCEPT_ROUTE_OPTIONS: Array<{
  value: UsedGearPendingReviewAcceptedStatus;
  label: string;
  description: string;
}> = [
  {
    value: 'Accepted - Awaiting Arrival',
    label: 'Awaiting Arrival',
    description: 'Use when the offer is accepted and the item has not arrived yet.',
  },
  {
    value: 'Accepted - Arrived, Awaiting SKU',
    label: 'Arrived, Awaiting SKU',
    description: 'Use when the item is on-site and still needs SKU assignment.',
  },
  {
    value: 'Accepted - Arrived, Awaiting Missing Item',
    label: 'Arrived, Awaiting Missing Item',
    description: 'Use when the intake is accepted but still needs a missing unit or accessory.',
  },
];

function stringFieldValue(fields: Record<string, unknown>, fieldName: string): string {
  const value = fields[fieldName];
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return '';
}

function previewText(value: unknown): string {
  const normalized = displayInventoryValue(value);
  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
}

function SummaryField({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 px-4 py-4">
      <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-sm text-[var(--ink)]">{displayInventoryValue(value)}</p>
    </div>
  );
}

function DetailBlock({ title, fields }: { title: string; fields: Array<{ label: string; value: unknown }> }) {
  return (
    <details className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5 text-sm text-[var(--muted)]">
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
        {title}
      </summary>
      <div className="mt-4 space-y-3">
        {fields.map((field) => (
          <div key={field.label}>
            <span className="font-semibold text-[var(--ink)]">{field.label}:</span> {displayInventoryValue(field.value)}
          </div>
        ))}
      </div>
    </details>
  );
}

function NoteTemplateRow({
  legend,
  templateGroup,
  onApplyTemplate,
}: {
  legend: string;
  templateGroup: 'qualification' | 'unqualified-reason';
  onApplyTemplate: (templateValue: string) => void;
}) {
  const templates = getUsedGearWorkflowNoteTemplates(templateGroup);

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <span className="self-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]/80">{legend}</span>
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

export function UsedGearPendingReviewRecordPage({
  currentUserName,
  recordId,
  onOpenManualIntake,
}: UsedGearPendingReviewRecordPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [context, setContext] = useState<UsedGearOperationalRecordContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptStatus, setAcceptStatus] = useState<UsedGearPendingReviewAcceptedStatus>('Accepted - Awaiting Arrival');
  const [qualificationNotes, setQualificationNotes] = useState('');
  const [unqualifiedReason, setUnqualifiedReason] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadRecord = async () => {
      setLoading(true);
      setError(null);

      try {
        const nextContext = await loadUsedGearOperationalRecordContext(recordId);
        if (!cancelled) {
          setContext(nextContext);
          setAcceptStatus(
            nextContext.record.fields['Workflow Status'] === 'Accepted - Arrived, Awaiting SKU'
              || nextContext.record.fields['Workflow Status'] === 'Accepted - Arrived, Awaiting Missing Item'
              ? nextContext.record.fields['Workflow Status'] as UsedGearPendingReviewAcceptedStatus
              : 'Accepted - Awaiting Arrival',
          );
          setQualificationNotes(stringFieldValue(nextContext.record.fields, 'Qualification Notes'));
          setUnqualifiedReason(stringFieldValue(nextContext.record.fields, 'Unqualified Reason'));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load the selected parking-lot review row.');
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
  const inputClassName = 'w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';

  const hasPricingPath = useMemo(() => record ? hasUsedGearPendingReviewPricingPath(record.fields) : false, [record]);
  const groupNeedsSubmissionId = useMemo(
    () => Boolean(group && group.records.length > 1 && stringFieldValue(record?.fields ?? {}, 'Submission Group ID').trim().length === 0),
    [group, record],
  );

  const backToQueue = () => {
    navigate({ pathname: '/parking-lot-1', search: location.search, hash: '#used-gear-pending-review' });
  };

  const handleAccept = async () => {
    if (!record) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await acceptPendingReviewRecord(record.id, currentUserName, {
        acceptedStatus: acceptStatus,
        qualificationNotes,
      });
      backToQueue();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to accept this parking-lot row into Lot 2.');
      setSaving(false);
    }
  };

  const handleUnqualify = async () => {
    if (!record) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await markPendingReviewUnqualified(record.id, unqualifiedReason);
      navigate({ pathname: '/trash-review', search: location.search, hash: '#used-gear-trash' });
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to move this parking-lot row into trash.');
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSurface message="Loading parking-lot review..." />;
  }

  if (!record) {
    return <ErrorSurface title="Unable to load parking-lot review" message={error ?? 'The selected Parking Lot 1 record could not be loaded.'} />;
  }

  const acceptRouteDescription = ACCEPT_ROUTE_OPTIONS.find((option) => option.value === acceptStatus)?.description;

  return (
    <PanelSurface>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <WorkflowPageHeader
          eyebrow="Parking Lot 1 Review"
          title={displayInventoryValue(record.fields.SKU)}
          description="Use this focused intake decision page to qualify the row into Lot 2 or route it into trash without working from the queue card."
          detail={<>{displayInventoryValue(record.fields.Make)} · {displayInventoryValue(record.fields.Model)}</>}
          actions={(
            <>
              <button
                type="button"
                className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                onClick={backToQueue}
              >
                Back To Parking Lot
              </button>
              <button
                type="button"
                className={smallSecondaryActionButtonClass}
                onClick={() => onOpenManualIntake(record.id)}
              >
                Open Manual Intake
              </button>
            </>
          )}
        />

        {error ? (
          <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {error}
          </div>
        ) : null}

        {group ? (
          <section className="rounded-2xl border border-sky-400/30 bg-sky-500/10 px-5 py-4 text-sm text-sky-100">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em]">Grouped Intake</p>
                <div className="mt-3 max-w-2xl">
                  <CollapsibleHelperText label="Why open the group page">
                    This row belongs to {group.label} with {group.records.length} intake rows. Use the group page when pricing, allocation, or routing should be managed together.
                  </CollapsibleHelperText>
                </div>
              </div>
              <button
                type="button"
                className="rounded-xl border border-sky-300/40 bg-white/5 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-white/10"
                onClick={() => navigate(`/parking-lot-1/review/${encodeURIComponent(group.id)}${location.search}`)}
              >
                Open Group Review
              </button>
            </div>
          </section>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          <SummaryField label="Workflow Source" value={record.fields['Workflow Source']} />
          <SummaryField label="Workflow Status" value={record.fields['Workflow Status']} />
          <SummaryField label="Pricing Gate" value={hasPricingPath ? 'Ready For Lot 2' : 'Missing Required Pricing'} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Route Into Lot 2</p>
            <h3 className="mt-2 text-xl font-semibold text-[var(--ink)]">Qualify Into Lot 2</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Choose the correct Lot 2 destination and leave the qualification note that explains why this intake should stay in the sellable workflow.</p>
            <div className="mt-4 grid gap-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Lot 2 Route</span>
                <select
                  className={inputClassName}
                  value={acceptStatus}
                  onChange={(event) => setAcceptStatus(event.currentTarget.value as UsedGearPendingReviewAcceptedStatus)}
                >
                  {ACCEPT_ROUTE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                {acceptRouteDescription ? <p className="mt-1 text-xs text-[var(--muted)]/80">{acceptRouteDescription}</p> : null}
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Qualification Notes</span>
                <textarea
                  className={inputClassName}
                  rows={5}
                  value={qualificationNotes}
                  onChange={(event) => setQualificationNotes(event.currentTarget.value)}
                  placeholder="Required before routing this item into Lot 2"
                />
              </label>
              <NoteTemplateRow
                legend="Quick templates"
                templateGroup="qualification"
                onApplyTemplate={(templateValue) => {
                  setQualificationNotes((currentValue) => applyUsedGearWorkflowNoteTemplate(currentValue, templateValue));
                }}
              />
              {groupNeedsSubmissionId ? (
                <p className="m-0 text-sm text-amber-300">This grouped intake still needs a Submission Group ID before it can be accepted into Lot 2.</p>
              ) : null}
              {!hasPricingPath ? (
                <p className="m-0 text-sm text-amber-300">Offer amount, paid amount, or confirmed grand total is required before this row can enter Lot 2.</p>
              ) : null}
              <button
                type="button"
                className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  void handleAccept();
                }}
                disabled={saving || qualificationNotes.trim().length === 0 || !hasPricingPath || groupNeedsSubmissionId}
              >
                {saving ? 'Saving...' : 'Accept Into Lot 2'}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-5">
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-rose-200">Trash Route</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Route To Trash</h3>
            <p className="mt-2 text-sm text-rose-100/80">Capture the reason clearly so downstream review can see why this intake was stopped before Lot 2.</p>
            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-rose-100/70">Unqualified Reason</span>
              <textarea
                className={inputClassName}
                rows={5}
                value={unqualifiedReason}
                onChange={(event) => setUnqualifiedReason(event.currentTarget.value)}
                placeholder="Required before sending this row into trash"
              />
            </label>
            <NoteTemplateRow
              legend="Common reasons"
              templateGroup="unqualified-reason"
              onApplyTemplate={(templateValue) => {
                setUnqualifiedReason((currentValue) => applyUsedGearWorkflowNoteTemplate(currentValue, templateValue));
              }}
            />
            <button
              type="button"
              className="mt-4 w-full rounded-xl border border-rose-300/35 bg-rose-500/20 px-4 py-3 text-sm font-semibold text-rose-50 transition hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => {
                void handleUnqualify();
              }}
              disabled={saving || unqualifiedReason.trim().length === 0}
            >
              {saving ? 'Saving...' : 'Send To Trash'}
            </button>
          </section>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <DetailBlock
            title="Pricing And Allocation"
            fields={[
              { label: 'Offer Amount', value: record.fields['Offer Amount'] },
              { label: 'Paid Amount', value: record.fields['Paid Amount'] },
              { label: 'Confirmed Grand Total', value: record.fields['Confirmed Grand Total'] },
              { label: 'Allocation Mode', value: record.fields['Allocation Mode'] },
              { label: 'Allocation Notes', value: record.fields['Allocation Notes'] },
            ]}
          />
          <DetailBlock
            title="Customer Intake Notes"
            fields={[
              { label: 'Cosmetic Notes', value: previewText(record.fields['Customer Cosmetic Notes']) },
              { label: 'Functional Notes', value: previewText(record.fields['Customer Functional Notes']) },
              { label: 'Inclusion Notes', value: previewText(record.fields['Customer Inclusion Notes']) },
              { label: 'Photos Notes', value: previewText(record.fields['Customer Submitted Photos Notes']) },
            ]}
          />
          <DetailBlock
            title="Internal Notes"
            fields={[
              { label: 'Qualification Complete', value: record.fields['Qualification Complete'] },
              { label: 'Qualification Notes', value: previewText(record.fields['Qualification Notes']) },
              { label: 'Internal Cosmetic Notes', value: previewText(record.fields['Internal Cosmetic Notes']) },
              { label: 'Internal Functional Notes', value: previewText(record.fields['Internal Functional Notes']) },
              { label: 'Internal Inclusion Notes', value: previewText(record.fields['Internal Inclusion Notes']) },
            ]}
          />
        </div>
      </div>
    </PanelSurface>
  );
}