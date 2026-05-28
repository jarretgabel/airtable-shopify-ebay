import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WorkflowQueuePageTemplate } from '@/components/app/WorkflowQueuePageTemplate';
import { UsedGearParkingLotSection } from '@/components/tabs/airtable/UsedGearParkingLotSection';
import { getUsedGearWorkflowStatus } from '@/services/usedGearWorkflow';
import { isParkingLotArrivalStageStatus, type UsedGearWorkflowGroup } from '@/services/usedGearQueue';
import type { AirtableRecord } from '@/types/airtable';

interface ParkingLotOneTabProps {
  currentUserName: string;
}

const WORKFLOW_PARKING_LOT_SEARCH_PARAM = 'workflowParkingLotSearch';
const WORKFLOW_PARKING_LOT_SORT_PARAM = 'workflowParkingLotSort';
const WORKFLOW_PARKING_LOT_SOURCE_PARAM = 'workflowParkingLotSource';

function isArrivalStageRecord(record: AirtableRecord): boolean {
  return isParkingLotArrivalStageStatus(getUsedGearWorkflowStatus(record.fields));
}

function isArrivalStageGroup(group: UsedGearWorkflowGroup): boolean {
  return group.records.every((record) => isArrivalStageRecord(record));
}

export function ParkingLotOneTab({ currentUserName }: ParkingLotOneTabProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const workflowParkingLotSearch = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get(WORKFLOW_PARKING_LOT_SEARCH_PARAM) ?? '';
  }, [location.search]);
  const workflowParkingLotSort = useMemo(() => {
    const value = new URLSearchParams(location.search).get(WORKFLOW_PARKING_LOT_SORT_PARAM);
    return value === 'newest' || value === 'oldest' || value === 'arrival-date' || value === 'make-model' ? value : 'group-label';
  }, [location.search]);
  const workflowParkingLotSource = useMemo(() => {
    const value = new URLSearchParams(location.search).get(WORKFLOW_PARKING_LOT_SOURCE_PARAM);
    return value === 'JotForm' || value === 'Manual Entry' ? value : 'all';
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
      eyebrow="Intake"
      title="Parking Lot"
    >
      <UsedGearParkingLotSection
        currentUserName={currentUserName}
        showSectionIntro={false}
        onOpenGroupReview={(group) => navigate(
          `${isArrivalStageGroup(group) ? '/parking-lot-1/arrival/group' : '/parking-lot-1/group'}/${encodeURIComponent(group.id)}${location.search}`,
          { replace: false },
        )}
        onOpenReviewRecord={(record) => navigate(
          `${isArrivalStageRecord(record) ? '/parking-lot-1/arrival' : '/parking-lot-1'}/${encodeURIComponent(record.id)}${location.search}`,
          { replace: false },
        )}
        searchTerm={workflowParkingLotSearch}
        onSearchTermChange={(value) => updateQueueSearch(WORKFLOW_PARKING_LOT_SEARCH_PARAM, value, '#used-gear-parking-lot')}
        sortMode={workflowParkingLotSort}
        onSortModeChange={(value) => updateIntakeRouteState((params) => {
          if (value === 'group-label') {
            params.delete(WORKFLOW_PARKING_LOT_SORT_PARAM);
          } else {
            params.set(WORKFLOW_PARKING_LOT_SORT_PARAM, value);
          }
        }, '#used-gear-parking-lot')}
        sourceFilter={workflowParkingLotSource}
        onSourceFilterChange={(value) => updateIntakeRouteState((params) => {
          if (value === 'all') {
            params.delete(WORKFLOW_PARKING_LOT_SOURCE_PARAM);
          } else {
            params.set(WORKFLOW_PARKING_LOT_SOURCE_PARAM, value);
          }
        }, '#used-gear-parking-lot')}
      />
    </WorkflowQueuePageTemplate>
  );
}