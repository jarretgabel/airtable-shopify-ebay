import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppPageLayout } from '@/components/app/AppPageLayout';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import {
  UsedGearWorkflowProgressSection,
  type UsedGearWorkflowProgressQueueMode,
  type UsedGearWorkflowProgressSortMode,
} from '@/components/tabs/airtable/UsedGearWorkflowProgressSection';

export interface UsedGearWorkflowQueueTabProps {
  queueMode: Exclude<UsedGearWorkflowProgressQueueMode, 'all'>;
  currentUserName: string;
  onOpenManualIntake: (recordId: string) => void;
  onOpenTestingForm: (recordId: string) => void;
  onOpenPhotosForm: (recordId: string) => void;
  onOpenOperationalRecord: (recordId: string) => void;
  onOpenListingsRecord: (recordId: string) => void;
}

interface QueueTabConfig {
  eyebrow: string;
  title: string;
  searchParamName: string;
  sortParamName: string;
  sectionId: string;
  hash: string;
}

const SORT_MODES: UsedGearWorkflowProgressSortMode[] = ['group-label', 'newest', 'oldest'];

function getQueueTabConfig(queueMode: Exclude<UsedGearWorkflowProgressQueueMode, 'all'>): QueueTabConfig {
  if (queueMode === 'testing') {
    return {
      eyebrow: 'Processing',
      title: 'Testing',
      searchParamName: 'workflowTestingQueueSearch',
      sortParamName: 'workflowTestingQueueSort',
      sectionId: 'used-gear-testing-queue',
      hash: '#used-gear-testing-queue',
    };
  }

  if (queueMode === 'photography') {
    return {
      eyebrow: 'Processing',
      title: 'Photography',
      searchParamName: 'workflowPhotographyQueueSearch',
      sortParamName: 'workflowPhotographyQueueSort',
      sectionId: 'used-gear-photography-queue',
      hash: '#used-gear-photography-queue',
    };
  }

  return {
    eyebrow: 'Processing',
    title: 'Testing',
    searchParamName: 'workflowTestingQueueSearch',
    sortParamName: 'workflowTestingQueueSort',
    sectionId: 'used-gear-testing-queue',
    hash: '#used-gear-testing-queue',
  };
}

function parseSortMode(search: string, paramName: string): UsedGearWorkflowProgressSortMode {
  const rawValue = new URLSearchParams(search).get(paramName)?.trim() ?? '';
  return SORT_MODES.includes(rawValue as UsedGearWorkflowProgressSortMode)
    ? rawValue as UsedGearWorkflowProgressSortMode
    : 'group-label';
}

export function UsedGearWorkflowQueueTab({
  queueMode,
  currentUserName,
  onOpenManualIntake,
  onOpenTestingForm,
  onOpenPhotosForm,
  onOpenOperationalRecord,
  onOpenListingsRecord,
}: UsedGearWorkflowQueueTabProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const config = getQueueTabConfig(queueMode);

  const searchTerm = useMemo(() => new URLSearchParams(location.search).get(config.searchParamName) ?? '', [config.searchParamName, location.search]);
  const sortMode = useMemo(() => parseSortMode(location.search, config.sortParamName), [config.sortParamName, location.search]);

  const updateRouteState = (update: (params: URLSearchParams) => void) => {
    const nextParams = new URLSearchParams(location.search);
    update(nextParams);

    const nextSearch = nextParams.toString();
    navigate({
      pathname: location.pathname,
      search: nextSearch ? `?${nextSearch}` : '',
      hash: config.hash,
    }, { replace: true });
  };

  return (
    <AppPageLayout>
      <WorkflowPageHeader
        eyebrow={config.eyebrow}
        title={config.title}
      />

      <UsedGearWorkflowProgressSection
        currentUserName={currentUserName}
        showSectionIntro={false}
        onOpenManualIntake={onOpenManualIntake}
        onOpenTestingForm={onOpenTestingForm}
        onOpenPhotosForm={onOpenPhotosForm}
        onOpenOperationalRecord={onOpenOperationalRecord}
        onOpenListingsRecord={onOpenListingsRecord}
        queueMode={queueMode}
        sectionId={config.sectionId}
        searchTerm={searchTerm}
        onSearchTermChange={(value) => updateRouteState((params) => {
          if (value.trim()) {
            params.set(config.searchParamName, value);
          } else {
            params.delete(config.searchParamName);
          }
        })}
        sortMode={sortMode}
        onSortModeChange={(value) => updateRouteState((params) => {
          if (value === 'group-label') {
            params.delete(config.sortParamName);
          } else {
            params.set(config.sortParamName, value);
          }
        })}
      />
    </AppPageLayout>
  );
}