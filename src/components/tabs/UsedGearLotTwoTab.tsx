import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  currentUserName,
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
      <section className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="m-0 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Used Gear Intake</p>
            <h2 className="mt-2 text-3xl font-semibold text-[var(--ink)]">Parking Lot 2</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Accepted intake rows live here until arrival handling, SKU assignment, or missing-item cleanup is complete. Open Incoming Gear, Testing, Photos, or the workflow detail page directly from the queue.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 px-4 py-4">
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Workflow Reviewer</p>
            <p className="mt-2 text-lg font-semibold text-[var(--ink)]">{currentUserName}</p>
          </div>
        </div>
      </section>

      <UsedGearLotTwoSection
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