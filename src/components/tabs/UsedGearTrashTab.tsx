import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WorkflowQueuePageTemplate } from '@/components/app/WorkflowQueuePageTemplate';
import { UsedGearTrashSection, type UsedGearTrashSortMode } from '@/components/tabs/airtable/UsedGearTrashSection';

interface UsedGearTrashTabProps {
  currentUserName: string;
  onOpenWorkflowRecord: (recordId: string) => void;
}

const WORKFLOW_TRASH_SEARCH_PARAM = 'workflowTrashSearch';
const WORKFLOW_TRASH_SORT_PARAM = 'workflowTrashSort';

export function UsedGearTrashTab({ onOpenWorkflowRecord }: UsedGearTrashTabProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const workflowTrashSearch = useMemo(() => new URLSearchParams(location.search).get(WORKFLOW_TRASH_SEARCH_PARAM) ?? '', [location.search]);
  const workflowTrashSort = useMemo(() => {
    const value = new URLSearchParams(location.search).get(WORKFLOW_TRASH_SORT_PARAM);
    return value === 'newest' || value === 'oldest' || value === 'arrival-date' || value === 'make-model'
      ? value as UsedGearTrashSortMode
      : 'group-label';
  }, [location.search]);

  const updateRouteState = (update: (params: URLSearchParams) => void) => {
    const nextParams = new URLSearchParams(location.search);
    update(nextParams);

    const nextSearch = nextParams.toString();
    navigate({
      pathname: location.pathname,
      search: nextSearch ? `?${nextSearch}` : '',
      hash: '#used-gear-trash',
    }, { replace: true });
  };

  return (
    <WorkflowQueuePageTemplate
      eyebrow="Used Gear Intake"
      title="Trash Review"
      description="Review unqualified rows and decide whether to restore or remove them."
      descriptionHint="Restore mistaken rejects back into Parking Lot 2, or permanently delete trash work that is finished."
    >
      <UsedGearTrashSection
        showSectionIntro={false}
        onOpenReviewRecord={(recordId) => navigate(`/trash-review/review/${encodeURIComponent(recordId)}${location.search}`, { replace: false })}
        onOpenWorkflowRecord={onOpenWorkflowRecord}
        searchTerm={workflowTrashSearch}
        onSearchTermChange={(value) => updateRouteState((params) => {
          if (value.trim()) {
            params.set(WORKFLOW_TRASH_SEARCH_PARAM, value);
          } else {
            params.delete(WORKFLOW_TRASH_SEARCH_PARAM);
          }
        })}
        sortMode={workflowTrashSort}
        onSortModeChange={(value) => updateRouteState((params) => {
          if (value === 'group-label') {
            params.delete(WORKFLOW_TRASH_SORT_PARAM);
          } else {
            params.set(WORKFLOW_TRASH_SORT_PARAM, value);
          }
        })}
      />
    </WorkflowQueuePageTemplate>
  );
}