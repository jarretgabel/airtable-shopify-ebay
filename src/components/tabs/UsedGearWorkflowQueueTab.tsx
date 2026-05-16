import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  UsedGearWorkflowProgressSection,
  type UsedGearWorkflowProgressQueueMode,
  type UsedGearWorkflowProgressSortMode,
} from '@/components/tabs/airtable/UsedGearWorkflowProgressSection';

export interface UsedGearWorkflowQueueTabProps {
  queueMode: Exclude<UsedGearWorkflowProgressQueueMode, 'all'>;
  currentUserName: string;
  onOpenIncomingGearForm: (recordId: string) => void;
  onOpenTestingForm: (recordId: string) => void;
  onOpenPhotosForm: (recordId: string) => void;
  onOpenOperationalRecord: (recordId: string) => void;
  onOpenListingsRecord: (recordId: string) => void;
}

interface QueueTabConfig {
  eyebrow: string;
  title: string;
  description: string;
  searchParamName: string;
  groupParamName: string;
  sortParamName: string;
  sectionId: string;
  hash: string;
}

const SORT_MODES: UsedGearWorkflowProgressSortMode[] = ['group-label', 'newest', 'oldest'];

function getQueueTabConfig(queueMode: Exclude<UsedGearWorkflowProgressQueueMode, 'all'>): QueueTabConfig {
  if (queueMode === 'testing') {
    return {
      eyebrow: 'Used Gear Workflow',
      title: 'Testing Queue',
      description: 'Testing operators can stay on one dedicated surface, keep grouped submissions together, and jump directly into the testing form or current operational surface when exceptions show up.',
      searchParamName: 'workflowTestingQueueSearch',
      groupParamName: 'workflowTestingQueueGroup',
      sortParamName: 'workflowTestingQueueSort',
      sectionId: 'used-gear-testing-queue',
      hash: '#used-gear-testing-queue',
    };
  }

  if (queueMode === 'photography') {
    return {
      eyebrow: 'Used Gear Workflow',
      title: 'Photography Queue',
      description: 'Photography operators can work from a dedicated queue, preserve grouped submissions, and jump directly into photo capture or the current operational surface without scanning the broader inventory surface.',
      searchParamName: 'workflowPhotographyQueueSearch',
      groupParamName: 'workflowPhotographyQueueGroup',
      sortParamName: 'workflowPhotographyQueueSort',
      sectionId: 'used-gear-photography-queue',
      hash: '#used-gear-photography-queue',
    };
  }

  return {
    eyebrow: 'Used Gear Workflow',
    title: 'Testing Queue',
    description: 'Testing operators can stay on one dedicated surface, keep grouped submissions together, and jump directly into the testing form or current operational surface when exceptions show up.',
    searchParamName: 'workflowTestingQueueSearch',
    groupParamName: 'workflowTestingQueueGroup',
    sortParamName: 'workflowTestingQueueSort',
    sectionId: 'used-gear-testing-queue',
    hash: '#used-gear-testing-queue',
  };
}

function parseFocusedGroup(search: string, paramName: string): string | null {
  const value = new URLSearchParams(search).get(paramName)?.trim() ?? '';
  return value ? value : null;
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
  onOpenIncomingGearForm,
  onOpenTestingForm,
  onOpenPhotosForm,
  onOpenOperationalRecord,
  onOpenListingsRecord,
}: UsedGearWorkflowQueueTabProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const config = getQueueTabConfig(queueMode);

  const searchTerm = useMemo(() => new URLSearchParams(location.search).get(config.searchParamName) ?? '', [config.searchParamName, location.search]);
  const focusedGroupId = useMemo(() => parseFocusedGroup(location.search, config.groupParamName), [config.groupParamName, location.search]);
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
    <>
      <section className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-5 py-5">
        <div className="max-w-3xl">
          <p className="m-0 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{config.eyebrow}</p>
          <h2 className="mt-2 text-3xl font-semibold text-[var(--ink)]">{config.title}</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{config.description}</p>
        </div>
      </section>

      <UsedGearWorkflowProgressSection
        currentUserName={currentUserName}
        showSectionIntro={false}
        onOpenIncomingGearForm={onOpenIncomingGearForm}
        onOpenTestingForm={onOpenTestingForm}
        onOpenPhotosForm={onOpenPhotosForm}
        onOpenOperationalRecord={onOpenOperationalRecord}
        onOpenListingsRecord={onOpenListingsRecord}
        queueMode={queueMode}
        sectionId={config.sectionId}
        groupParamName={config.groupParamName}
        focusedGroupId={focusedGroupId}
        onFocusedGroupIdChange={(groupId) => updateRouteState((params) => {
          if (groupId) {
            params.set(config.groupParamName, groupId);
          } else {
            params.delete(config.groupParamName);
          }
        })}
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
    </>
  );
}