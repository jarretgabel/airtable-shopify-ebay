import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WorkflowQueuePageTemplate } from '@/components/app/WorkflowQueuePageTemplate';
import { UsedGearLotTwoSection, type UsedGearLotTwoSortMode } from '@/components/tabs/airtable/UsedGearLotTwoSection';

interface UsedGearLotTwoTabProps {
  currentUserName: string;
  onOpenIncomingGearForm: (recordId: string) => void;
  onOpenTestingForm: (recordId: string) => void;
  onOpenPhotosForm: (recordId: string) => void;
  onOpenWorkflowRecord: (recordId: string) => void;
}

const WORKFLOW_LOT_TWO_SEARCH_PARAM = 'workflowLotTwoSearch';
const WORKFLOW_LOT_TWO_SORT_PARAM = 'workflowLotTwoSort';
const WORKFLOW_LOT_TWO_GROUP_PARAM = 'workflowLotTwoGroup';

export function UsedGearLotTwoTab({
  onOpenIncomingGearForm,
  onOpenTestingForm,
  onOpenPhotosForm,
  onOpenWorkflowRecord,
}: UsedGearLotTwoTabProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const workflowLotTwoSearch = useMemo(() => new URLSearchParams(location.search).get(WORKFLOW_LOT_TWO_SEARCH_PARAM) ?? '', [location.search]);
  const workflowLotTwoGroup = useMemo(() => {
    const value = new URLSearchParams(location.search).get(WORKFLOW_LOT_TWO_GROUP_PARAM)?.trim() ?? '';
    return value ? value : null;
  }, [location.search]);
  const workflowLotTwoSort = useMemo(() => {
    const value = new URLSearchParams(location.search).get(WORKFLOW_LOT_TWO_SORT_PARAM);
    return value === 'newest' || value === 'oldest' || value === 'arrival-date' || value === 'make-model'
      ? value as UsedGearLotTwoSortMode
      : 'group-label';
  }, [location.search]);

  const updateRouteState = (update: (params: URLSearchParams) => void, hash: string) => {
    const nextParams = new URLSearchParams(location.search);
    update(nextParams);

    const nextSearch = nextParams.toString();
    navigate({
      pathname: location.pathname,
      search: nextSearch ? `?${nextSearch}` : '',
      hash,
    }, { replace: true });
  };

  return (
    <WorkflowQueuePageTemplate
      eyebrow="Used Gear Intake"
      title="Parking Lot 2"
      description="Track accepted intake through arrival, SKU assignment, and the next handoff."
      descriptionHint="Use the queue actions to open Incoming Gear, Testing, Photos, or the workflow record directly from this page."
    >
      <UsedGearLotTwoSection
        showSectionIntro={false}
        onOpenIncomingGearForm={onOpenIncomingGearForm}
        onOpenTestingForm={onOpenTestingForm}
        onOpenPhotosForm={onOpenPhotosForm}
        onOpenWorkflowRecord={onOpenWorkflowRecord}
        focusedGroupId={workflowLotTwoGroup}
        onFocusedGroupIdChange={(groupId) => updateRouteState((params) => {
          if (groupId) {
            params.set(WORKFLOW_LOT_TWO_GROUP_PARAM, groupId);
          } else {
            params.delete(WORKFLOW_LOT_TWO_GROUP_PARAM);
          }
        }, '#used-gear-lot-two')}
        searchTerm={workflowLotTwoSearch}
        onSearchTermChange={(value) => updateRouteState((params) => {
          if (value.trim()) {
            params.set(WORKFLOW_LOT_TWO_SEARCH_PARAM, value);
          } else {
            params.delete(WORKFLOW_LOT_TWO_SEARCH_PARAM);
          }
        }, '#used-gear-lot-two')}
        sortMode={workflowLotTwoSort}
        onSortModeChange={(value) => updateRouteState((params) => {
          if (value === 'group-label') {
            params.delete(WORKFLOW_LOT_TWO_SORT_PARAM);
          } else {
            params.set(WORKFLOW_LOT_TWO_SORT_PARAM, value);
          }
        }, '#used-gear-lot-two')}
      />
    </WorkflowQueuePageTemplate>
  );
}