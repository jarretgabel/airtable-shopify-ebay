import { useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PAGE_DEFINITIONS } from '@/auth/pages';
import { CollapsibleHelperText } from '@/components/app/CollapsibleHelperText';
import { PanelSurface } from '@/components/app/StateSurfaces';
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
  description: string;
  stageSummary: string;
  routeDetail: string;
  searchParamName: string;
  sortParamName: string;
  sectionId: string;
  hash: string;
  guidanceCards: Array<{ label: string; description: string }>;
}

const SORT_MODES: UsedGearWorkflowProgressSortMode[] = ['group-label', 'newest', 'oldest'];

function getQueueTabConfig(queueMode: Exclude<UsedGearWorkflowProgressQueueMode, 'all'>): QueueTabConfig {
  if (queueMode === 'testing') {
    return {
      eyebrow: 'Used Gear Workflow',
      title: 'Testing Queue',
      description: 'Testing operators can stay on one dedicated surface, keep grouped submissions together, and jump directly into the testing form or current operational surface when exceptions show up.',
      stageSummary: 'Accepted rows land here after intake approval and processing signoff. This queue is the shared post-intake holding stage for hands-on bench verification, not a listing-review destination.',
      routeDetail: 'Use the queue to triage, filter, sort, and share grouped work. Use the Testing form to capture findings and the testing signoff that moves the row toward listing readiness.',
      searchParamName: 'workflowTestingQueueSearch',
      sortParamName: 'workflowTestingQueueSort',
      sectionId: 'used-gear-testing-queue',
      hash: '#used-gear-testing-queue',
      guidanceCards: [
        {
          label: 'Rows Land Here',
          description: 'Accepted intake rows move here before Listings. Testing starts from the post-intake holding pool shared with photography.',
        },
        {
          label: 'Complete On Form',
          description: 'Testing completion is written only when the Testing form is saved. The queue stays focused on discovery, grouping, and handoff.',
        },
        {
          label: 'Leave For Listings',
          description: 'A row should reach Listings only after both testing and photography signoffs are complete.',
        },
      ],
    };
  }

  if (queueMode === 'photography') {
    return {
      eyebrow: 'Used Gear Workflow',
      title: 'Photography Queue',
      description: 'Photography operators can work from a dedicated queue, preserve grouped submissions, and jump directly into photo capture or the current operational surface without scanning the broader inventory surface.',
      stageSummary: 'Accepted rows land here after intake approval and processing signoff. This queue is the shared post-intake holding stage for photography work, not an early listing-prep page.',
      routeDetail: 'Use the queue to keep grouped submissions together, confirm which rows still need image work, and jump into the Photos form only when the unit is ready for photography completion.',
      searchParamName: 'workflowPhotographyQueueSearch',
      sortParamName: 'workflowPhotographyQueueSort',
      sectionId: 'used-gear-photography-queue',
      hash: '#used-gear-photography-queue',
      guidanceCards: [
        {
          label: 'Rows Land Here',
          description: 'Accepted intake rows move here before Listings. Photography shares the same downstream holding pool as testing.',
        },
        {
          label: 'Complete On Form',
          description: 'Photography completion is written only when the Photos form is saved. The queue stays focused on discovery, grouping, and handoff.',
        },
        {
          label: 'Carry Forward Context',
          description: 'Use the queue and grouped links to preserve testing notes, included-item context, and submission-level handoff details while planning shoots.',
        },
      ],
    };
  }

  return {
    eyebrow: 'Used Gear Workflow',
    title: 'Testing Queue',
    description: 'Testing operators can stay on one dedicated surface, keep grouped submissions together, and jump directly into the testing form or current operational surface when exceptions show up.',
    stageSummary: 'Accepted rows land here after intake approval and processing signoff. This queue is the shared post-intake holding stage for hands-on bench verification, not a listing-review destination.',
    routeDetail: 'Use the queue to triage, filter, sort, and share grouped work. Use the Testing form to capture findings and the testing signoff that moves the row toward listing readiness.',
    searchParamName: 'workflowTestingQueueSearch',
    sortParamName: 'workflowTestingQueueSort',
    sectionId: 'used-gear-testing-queue',
    hash: '#used-gear-testing-queue',
    guidanceCards: [
      {
        label: 'Rows Land Here',
        description: 'Accepted intake rows move here before Listings. Testing starts from the post-intake holding pool shared with photography.',
      },
      {
        label: 'Complete On Form',
        description: 'Testing completion is written only when the Testing form is saved. The queue stays focused on discovery, grouping, and handoff.',
      },
      {
        label: 'Leave For Listings',
        description: 'A row should reach Listings only after both testing and photography signoffs are complete.',
      },
    ],
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
    <PanelSurface>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <WorkflowPageHeader
          eyebrow={config.eyebrow}
          title={config.title}
          description={config.description}
        />

        <CollapsibleHelperText label="How to use this queue" defaultExpanded={false}>
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Post-Intake Holding Stage</p>
              <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted)]">
                <p className="m-0">{config.stageSummary}</p>
                <p className="m-0">{config.routeDetail}</p>
                <p className="m-0">Filtering, grouped context, search, sort modes, and shareable queue links stay URL-backed here so teammates can hand off one exact workset instead of a vague list.</p>
              </div>
            </div>

            <aside className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Working Rules</p>
              <div className="mt-4 space-y-3">
                {config.guidanceCards.map((card) => (
                  <div key={card.label} className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
                    <p className="m-0 text-sm font-semibold text-[var(--ink)]">{card.label}</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{card.description}</p>
                  </div>
                ))}
              </div>
            </aside>
          </section>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
            <span>Need the full cross-stage routing and handoff guide?</span>
            <Link
              to={PAGE_DEFINITIONS['workflow-guide'].path}
              className="font-semibold text-[var(--accent)] transition hover:brightness-110"
            >
              Open Workflow Guide
            </Link>
          </div>
        </CollapsibleHelperText>

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
      </div>
    </PanelSurface>
  );
}