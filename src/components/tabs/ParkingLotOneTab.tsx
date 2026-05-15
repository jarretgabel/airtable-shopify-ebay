import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WorkflowQueuePageTemplate } from '@/components/app/WorkflowQueuePageTemplate';
import { UsedGearPendingReviewSection } from '@/components/tabs/airtable/UsedGearPendingReviewSection';

interface ParkingLotOneTabProps {
  currentUserName: string;
  onOpenWorkflowRecord: (recordId: string) => void;
}

const WORKFLOW_PENDING_REVIEW_SEARCH_PARAM = 'workflowPendingReviewSearch';
const WORKFLOW_PENDING_REVIEW_SORT_PARAM = 'workflowPendingReviewSort';
const WORKFLOW_PENDING_REVIEW_GROUP_PARAM = 'workflowPendingReviewGroup';

export function ParkingLotOneTab({ currentUserName, onOpenWorkflowRecord }: ParkingLotOneTabProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const workflowPendingReviewSearch = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get(WORKFLOW_PENDING_REVIEW_SEARCH_PARAM) ?? '';
  }, [location.search]);
  const workflowPendingReviewGroup = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const value = params.get(WORKFLOW_PENDING_REVIEW_GROUP_PARAM)?.trim() ?? '';
    return value ? value : null;
  }, [location.search]);
  const workflowPendingReviewSort = useMemo(() => {
    const value = new URLSearchParams(location.search).get(WORKFLOW_PENDING_REVIEW_SORT_PARAM);
    return value === 'newest' || value === 'oldest' || value === 'arrival-date' || value === 'make-model' ? value : 'group-label';
  }, [location.search]);

  const updateIntakeRouteState = (update: (params: URLSearchParams) => void, hash: string) => {
    const nextParams = new URLSearchParams(location.search);
    update(nextParams);

    const nextSearch = nextParams.toString();
    navigate({ pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '', hash }, { replace: true });
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

  return (
    <WorkflowQueuePageTemplate
      eyebrow="Used Gear Intake"
      title="Parking Lot 1"
      description="Review new intake and decide whether each item is accepted or trashed."
      descriptionHint="Open a group or single row to confirm qualification details before moving it forward."
    >
      <UsedGearPendingReviewSection
        currentUserName={currentUserName}
        showSectionIntro={false}
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
        sortMode={workflowPendingReviewSort}
        onSortModeChange={(value) => updateIntakeRouteState((params) => {
          if (value === 'group-label') {
            params.delete(WORKFLOW_PENDING_REVIEW_SORT_PARAM);
          } else {
            params.set(WORKFLOW_PENDING_REVIEW_SORT_PARAM, value);
          }
        }, '#used-gear-pending-review')}
      />
    </WorkflowQueuePageTemplate>
  );
}