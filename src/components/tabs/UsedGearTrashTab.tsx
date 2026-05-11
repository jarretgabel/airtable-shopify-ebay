import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UsedGearTrashSection } from '@/components/tabs/airtable/UsedGearTrashSection';

interface UsedGearTrashTabProps {
  currentUserName: string;
  onOpenWorkflowRecord: (recordId: string) => void;
}

const WORKFLOW_TRASH_SEARCH_PARAM = 'workflowTrashSearch';

export function UsedGearTrashTab({ currentUserName, onOpenWorkflowRecord }: UsedGearTrashTabProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const workflowTrashSearch = useMemo(() => new URLSearchParams(location.search).get(WORKFLOW_TRASH_SEARCH_PARAM) ?? '', [location.search]);

  const updateRouteState = (value: string) => {
    const nextParams = new URLSearchParams(location.search);
    if (value.trim()) {
      nextParams.set(WORKFLOW_TRASH_SEARCH_PARAM, value);
    } else {
      nextParams.delete(WORKFLOW_TRASH_SEARCH_PARAM);
    }

    const nextSearch = nextParams.toString();
    navigate({
      pathname: location.pathname,
      search: nextSearch ? `?${nextSearch}` : '',
      hash: '#used-gear-trash',
    }, { replace: true });
  };

  return (
    <>
      <section className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="m-0 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Used Gear Intake</p>
            <h2 className="mt-2 text-3xl font-semibold text-[var(--ink)]">Trash Review</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Review unqualified workflow rows in one place. Restore mistakes, re-qualify items back into Parking Lot 2, or permanently delete work that should leave the queue.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 px-4 py-4">
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Workflow Reviewer</p>
            <p className="mt-2 text-lg font-semibold text-[var(--ink)]">{currentUserName}</p>
          </div>
        </div>
      </section>

      <UsedGearTrashSection
        onOpenReviewRecord={(recordId) => navigate(`/trash-review/review/${encodeURIComponent(recordId)}${location.search}`, { replace: false })}
        onOpenWorkflowRecord={onOpenWorkflowRecord}
        searchTerm={workflowTrashSearch}
        onSearchTermChange={updateRouteState}
      />
    </>
  );
}