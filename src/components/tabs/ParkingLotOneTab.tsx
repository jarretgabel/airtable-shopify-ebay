import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WorkflowQueuePageTemplate } from '@/components/app/WorkflowQueuePageTemplate';
import { UsedGearPendingReviewSection } from '@/components/tabs/airtable/UsedGearPendingReviewSection';

interface ParkingLotOneTabProps {
  currentUserName: string;
}

const WORKFLOW_PENDING_REVIEW_SEARCH_PARAM = 'workflowPendingReviewSearch';
const WORKFLOW_PENDING_REVIEW_SORT_PARAM = 'workflowPendingReviewSort';

export function ParkingLotOneTab({ currentUserName }: ParkingLotOneTabProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const workflowPendingReviewSearch = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get(WORKFLOW_PENDING_REVIEW_SEARCH_PARAM) ?? '';
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
    >
      <UsedGearPendingReviewSection
        currentUserName={currentUserName}
        showSectionIntro={false}
        onOpenGroupReview={(groupId) => navigate(`/parking-lot-1/review/${encodeURIComponent(groupId)}${location.search}`, { replace: false })}
        onOpenReviewRecord={(recordId) => navigate(`/parking-lot-1/review-record/${encodeURIComponent(recordId)}${location.search}`, { replace: false })}
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