import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UsedGearPendingReviewSection } from '@/components/tabs/airtable/UsedGearPendingReviewSection';
import type { JotformTabViewModel } from '@/app/appTabViewModels';
import { formatAnswer } from '@/services/jotform';
import { EmptySurface, ErrorSurface, LoadingSurface, PanelSurface } from '@/components/app/StateSurfaces';

interface JotformTabProps {
  viewModel: JotformTabViewModel;
  currentUserName: string;
  onOpenWorkflowRecord: (recordId: string) => void;
}

const WORKFLOW_PENDING_REVIEW_SEARCH_PARAM = 'workflowPendingReviewSearch';
const WORKFLOW_PENDING_REVIEW_COLLAPSED_PARAM = 'workflowPendingReviewCollapsedGroups';
const WORKFLOW_PENDING_REVIEW_SORT_PARAM = 'workflowPendingReviewSort';
const WORKFLOW_PENDING_REVIEW_GROUP_PARAM = 'workflowPendingReviewGroup';

export function JotformTab({
  viewModel,
  currentUserName,
  onOpenWorkflowRecord,
}: JotformTabProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { submissions, loading, polling, error, refetch, lastUpdated, freshCount, clearFresh } = viewModel;
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);

  const activeSubmissions = useMemo(
    () => submissions.filter((submission) => submission.status === 'ACTIVE'),
    [submissions],
  );
  const totalNewSubmissions = useMemo(
    () => submissions.filter((submission) => submission.new === '1').length,
    [submissions],
  );
  const workflowPendingReviewSearch = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get(WORKFLOW_PENDING_REVIEW_SEARCH_PARAM) ?? '';
  }, [location.search]);
  const workflowPendingReviewGroup = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const value = params.get(WORKFLOW_PENDING_REVIEW_GROUP_PARAM)?.trim() ?? '';
    return value ? value : null;
  }, [location.search]);
  const workflowPendingReviewCollapsedGroups = useMemo(() => {
    const value = new URLSearchParams(location.search).get(WORKFLOW_PENDING_REVIEW_COLLAPSED_PARAM) ?? '';
    return value.split(',').map((entry) => entry.trim()).filter(Boolean);
  }, [location.search]);
  const workflowPendingReviewSort = useMemo(() => {
    const value = new URLSearchParams(location.search).get(WORKFLOW_PENDING_REVIEW_SORT_PARAM);
    return value === 'newest' || value === 'oldest' || value === 'arrival-date' || value === 'make-model' ? value : 'group-label';
  }, [location.search]);

  const updateIntakeRouteState = (update: (params: URLSearchParams) => void, hash: string) => {
    const nextParams = new URLSearchParams(location.search);
    update(nextParams);

    const nextSearch = nextParams.toString();
    navigate({
      pathname: location.pathname,
      search: nextSearch ? `?${nextSearch}` : '',
      hash,
    }, { replace: true });
  };

  const updateQueueSearch = (paramName: string, value: string, hash: string) => {
    updateIntakeRouteState((params) => {
      if (value.trim().length === 0) {
        params.delete(paramName);
      } else {
        params.set(paramName, value);
      }
    }, hash);
  };

  const updatePendingCollapsedGroups = (groupIds: string[]) => {
    updateIntakeRouteState((params) => {
      if (groupIds.length === 0) {
        params.delete(WORKFLOW_PENDING_REVIEW_COLLAPSED_PARAM);
      } else {
        params.set(WORKFLOW_PENDING_REVIEW_COLLAPSED_PARAM, groupIds.join(','));
      }
    }, '#used-gear-pending-review');
  };

  const updatePendingSort = (value: string) => {
    updateIntakeRouteState((params) => {
      if (value === 'group-label') {
        params.delete(WORKFLOW_PENDING_REVIEW_SORT_PARAM);
      } else {
        params.set(WORKFLOW_PENDING_REVIEW_SORT_PARAM, value);
      }
    }, '#used-gear-pending-review');
  };

  return (
    <>
      <section className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="m-0 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Used Gear Intake</p>
            <h2 className="mt-2 text-3xl font-semibold text-[var(--ink)]">Parking Lot 1</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              This page is now the first-stop intake triage surface for JotForm-origin workflow rows. Use the pending review queue to accept qualified rows into the workflow or route unqualified rows into trash, and keep the live JotForm feed below as source reference while intake is being worked.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[360px]">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 px-4 py-4">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Active Submissions</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{activeSubmissions.length}</p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 px-4 py-4">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Unread Feed</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{totalNewSubmissions}</p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 px-4 py-4">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Workflow Reviewer</p>
              <p className="mt-2 text-lg font-semibold text-[var(--ink)]">{currentUserName}</p>
            </div>
          </div>
        </div>
      </section>

      <UsedGearPendingReviewSection
        currentUserName={currentUserName}
        onOpenGroupReview={(groupId) => navigate(`/parking-lot-1/review/${encodeURIComponent(groupId)}${location.search}`, { replace: false })}
        onOpenReviewRecord={(recordId) => navigate(`/parking-lot-1/review-record/${encodeURIComponent(recordId)}${location.search}`, { replace: false })}
        onOpenWorkflowRecord={onOpenWorkflowRecord}
        focusedGroupId={workflowPendingReviewGroup}
        onFocusedGroupIdChange={(groupId) => updateIntakeRouteState((params) => {
          if (groupId) {
            params.set(WORKFLOW_PENDING_REVIEW_GROUP_PARAM, groupId);
          } else {
            params.delete(WORKFLOW_PENDING_REVIEW_GROUP_PARAM);
          }
        }, '#used-gear-pending-review')}
        searchTerm={workflowPendingReviewSearch}
        onSearchTermChange={(value) => updateQueueSearch(WORKFLOW_PENDING_REVIEW_SEARCH_PARAM, value, '#used-gear-pending-review')}
        collapsedGroupIds={workflowPendingReviewCollapsedGroups}
        onCollapsedGroupIdsChange={updatePendingCollapsedGroups}
        sortMode={workflowPendingReviewSort}
        onSortModeChange={updatePendingSort}
      />

      <div className="mt-3 flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-sm md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-[var(--muted)]">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${polling ? 'bg-amber-500' : 'bg-emerald-500'} ${polling ? '' : 'animate-pulse'}`} />
          <span className="font-semibold text-[var(--ink)]">Live JotForm Feed · Reference Only</span>
          {lastUpdated && (
            <span>Updated {lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</span>
          )}
          {polling && <span className="font-semibold text-amber-500">Checking...</span>}
        </div>
        {!loading && submissions.length > 0 && (
          <span className="text-[var(--muted)]">
            {submissions.length.toLocaleString()} submissions
            {totalNewSubmissions > 0 && <span className="text-amber-300"> · {totalNewSubmissions.toLocaleString()} unread</span>}
          </span>
        )}
      </div>

      {freshCount > 0 && (
        <div className="mt-3 flex flex-col gap-3 rounded-xl border border-blue-400/35 bg-blue-500/15 px-4 py-3 text-sm text-blue-100 sm:flex-row sm:items-center sm:justify-between">
          <span>🔔 <strong>{freshCount}</strong> new submission{freshCount !== 1 ? 's' : ''} received since you opened this page</span>
          <button
            type="button"
            className="rounded-lg border border-blue-300/45 bg-white/5 px-3 py-1.5 text-xs font-semibold text-blue-100 transition hover:bg-white/10"
            onClick={() => {
              clearFresh();
              refetch();
            }}
          >
            Reload list
          </button>
        </div>
      )}

      {error && (
        <ErrorSurface title="Error loading submissions" message={error.message}>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Confirm the backend JotForm credentials are configured for your local API or deployed Lambda environment.
          </p>
        </ErrorSurface>
      )}

      {loading && (
        <LoadingSurface message="Loading JotForm submission feed..." />
      )}

      {!loading && activeSubmissions.length > 0 && (
        <PanelSurface>
          <div className="mb-4 border-b border-[var(--line)] pb-3">
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Reference Feed</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Keep this feed available for source verification while Parking Lot 1 workflow rows are being triaged above.
            </p>
          </div>
          <ul className="list-none m-0 p-0">
            {activeSubmissions.map((submission) => {
              const isExpanded = expandedSubmissionId === submission.id;
              const isNew = submission.new === '1';
              const sortedAnswers = Object.values(submission.answers)
                .filter((answer) => formatAnswer(answer.answer))
                .sort((a, b) => Number(a.order) - Number(b.order));
              const previewAnswer = sortedAnswers[0];
              const submittedAt = new Date(submission.created_at);

              return (
                <li key={submission.id} className="border-b border-[var(--line)] last:border-b-0">
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center justify-between gap-4 py-3 text-left"
                    onClick={() => setExpandedSubmissionId(isExpanded ? null : submission.id)}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {isNew && <span className="inline-block h-2 w-2 rounded-full bg-[var(--accent)]" />}
                      <div className="min-w-0">
                        <span className={`block truncate text-sm font-semibold ${isNew ? 'text-[var(--accent)]' : 'text-[var(--ink)]'}`}>
                          {previewAnswer ? formatAnswer(previewAnswer.answer) : `Submission #${submission.id}`}
                        </span>
                        {sortedAnswers[1] && (
                          <span className="block truncate text-xs text-[var(--muted)]">
                            {formatAnswer(sortedAnswers[1].answer)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2 text-xs text-[var(--muted)]">
                      <span>{submittedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span className="text-sm">{isExpanded ? '▾' : '›'}</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="pb-4 pl-5 sm:pl-7">
                      <dl className="m-0 flex flex-col gap-2">
                        {sortedAnswers.map((answer) => (
                          <div key={answer.name} className="grid grid-cols-1 gap-1 sm:grid-cols-[200px_1fr] sm:gap-4">
                            <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">{answer.text || answer.name}</dt>
                            <dd className="m-0 text-sm text-[var(--ink)] break-words">{formatAnswer(answer.answer)}</dd>
                          </div>
                        ))}
                      </dl>
                      <p className="m-0 mt-3 border-t border-[var(--line)] pt-2 text-xs text-[var(--muted)]">
                        Submitted {submittedAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                        {submission.ip && ` · IP ${submission.ip}`}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </PanelSurface>
      )}

      {!loading && !error && activeSubmissions.length === 0 && (
        <EmptySurface title="No live JotForm submissions" message="New JotForm submissions will appear here automatically as source-reference data for Parking Lot 1 intake review." />
      )}
    </>
  );
}
