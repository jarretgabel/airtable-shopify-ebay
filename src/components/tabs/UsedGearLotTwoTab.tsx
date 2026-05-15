import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import { UsedGearLotTwoSection } from '@/components/tabs/airtable/UsedGearLotTwoSection';

interface UsedGearLotTwoTabProps {
  currentUserName: string;
  onOpenIncomingGearForm: (recordId: string) => void;
  onOpenTestingForm: (recordId: string) => void;
  onOpenPhotosForm: (recordId: string) => void;
  onOpenWorkflowRecord: (recordId: string) => void;
}

const WORKFLOW_LOT_TWO_SEARCH_PARAM = 'workflowLotTwoSearch';
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
    <>
      <div className="mt-3 mb-6">
        <WorkflowPageHeader
          eyebrow="Used Gear Intake"
          title="Parking Lot 2"
          description="Track accepted intake until arrival handling, SKU assignment, and the next handoff are complete."
          descriptionHint="Accepted intake rows live here until arrival handling, SKU assignment, or missing-item cleanup is complete. Open Incoming Gear, Testing, Photos, or the workflow detail page directly from the queue."
        />
      </div>

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
      />
    </>
  );
}