import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import { UsedGearTrashSection } from '@/components/tabs/airtable/UsedGearTrashSection';

interface UsedGearTrashTabProps {
  currentUserName: string;
  onOpenWorkflowRecord: (recordId: string) => void;
}

const WORKFLOW_TRASH_SEARCH_PARAM = 'workflowTrashSearch';

export function UsedGearTrashTab({ onOpenWorkflowRecord }: UsedGearTrashTabProps) {
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
      <div className="mt-3 mb-6">
        <WorkflowPageHeader
          eyebrow="Used Gear Intake"
          title="Trash Review"
          description="Review unqualified rows, correct mistakes, or remove work that should leave the queue."
          descriptionHint="Restore mistakes, re-qualify items back into Parking Lot 2, or permanently delete work that should leave the workflow."
        />
      </div>

      <UsedGearTrashSection
        showSectionIntro={false}
        onOpenReviewRecord={(recordId) => navigate(`/trash-review/review/${encodeURIComponent(recordId)}${location.search}`, { replace: false })}
        onOpenWorkflowRecord={onOpenWorkflowRecord}
        searchTerm={workflowTrashSearch}
        onSearchTermChange={updateRouteState}
      />
    </>
  );
}