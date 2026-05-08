export interface ListingApprovalWorkflowSummaryData {
  workflowStatus: string;
  resolvedTitle: string;
  resolvedDescription: string;
  resolvedPrice: string;
  priceSourceFieldName: string | null;
  preListingReviewedBy: string;
}

interface ListingApprovalWorkflowSummaryProps {
  summary: ListingApprovalWorkflowSummaryData;
}

export function ListingApprovalWorkflowSummary({ summary }: ListingApprovalWorkflowSummaryProps) {
  return (
    <section className="mb-4 rounded-2xl border border-[var(--line)] bg-white/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Workflow Review Context</p>
          <h4 className="m-0 mt-2 text-base font-semibold text-[var(--ink)]">Used-Gear Handoff Summary</h4>
        </div>
        <span className="inline-block rounded-full border border-sky-400/30 bg-sky-500/15 px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.06em] text-sky-200">
          {summary.workflowStatus}
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-3 text-sm text-[var(--muted)]">
          <div>Resolved Title</div>
          <div className="mt-1 font-semibold text-[var(--ink)]">{summary.resolvedTitle || 'Missing title'}</div>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-3 text-sm text-[var(--muted)]">
          <div>Resolved Price</div>
          <div className="mt-1 font-semibold text-[var(--ink)]">{summary.resolvedPrice || 'Missing price'}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.08em]">{summary.priceSourceFieldName || 'No price field found'}</div>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-3 text-sm text-[var(--muted)]">
          <div>Pre-Listing Reviewer</div>
          <div className="mt-1 font-semibold text-[var(--ink)]">{summary.preListingReviewedBy || 'Not signed yet'}</div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-3 text-sm text-[var(--muted)]">
        <div className="font-semibold text-[var(--ink)]">Resolved Description</div>
        <div className="mt-1 whitespace-pre-wrap leading-6">{summary.resolvedDescription || 'No description resolved yet.'}</div>
      </div>
    </section>
  );
}