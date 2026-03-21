import { useMemo, useState } from 'react';
import type { JotformTabViewModel } from '@/app/appTabViewModels';
import { formatAnswer } from '@/services/jotform';
import { EmptySurface, ErrorSurface, LoadingSurface, PanelSurface } from '@/components/app/StateSurfaces';

interface JotformTabProps {
  viewModel: JotformTabViewModel;
}

export function JotformTab({ viewModel }: JotformTabProps) {
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

  return (
    <>
      <div className="mt-3 flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-sm md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-[var(--muted)]">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${polling ? 'bg-amber-500' : 'bg-emerald-500'} ${polling ? '' : 'animate-pulse'}`} />
          <span className="font-semibold text-[var(--ink)]">Live · Request a Quote</span>
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
            Make sure <code>VITE_JOTFORM_API_KEY</code> and <code>VITE_JOTFORM_FORM_ID</code> are set in <code>.env.local</code>.
          </p>
        </ErrorSurface>
      )}

      {loading && (
        <LoadingSurface message="Loading submissions from JotForm..." />
      )}

      {!loading && activeSubmissions.length > 0 && (
        <PanelSurface>
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
        <EmptySurface title="No submissions yet" message="Submissions will appear here automatically as your form receives responses." />
      )}
    </>
  );
}
