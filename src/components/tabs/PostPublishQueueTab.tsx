import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MainPageSectionNav } from '@/components/app/MainPageSectionNav';
import { usePageSectionTracking } from '@/components/app/usePageSectionTracking';
import { WorkflowQueuePageTemplate } from '@/components/app/WorkflowQueuePageTemplate';
import {
  getPostPublishSectionId,
  POST_PUBLISH_OVERVIEW_SECTION_ID,
  POST_PUBLISH_SECTION_DEFINITIONS,
  UsedGearWorkflowPostPublishSection,
  type UsedGearWorkflowPostPublishSortMode,
} from '@/components/tabs/airtable/UsedGearWorkflowPostPublishSection';
import type { UsedGearWorkflowPostPublishBucket } from '@/services/usedGearWorkflowLifecycle';

interface PostPublishQueueTabProps {
  currentUserName: string;
  onOpenOperationalRecord: (recordId: string) => void;
  onOpenListingsRecord: (recordId: string) => void;
}

const WORKFLOW_POST_PUBLISH_SEARCH_PARAM = 'workflowPostPublishSearch';
const WORKFLOW_POST_PUBLISH_SORT_PARAM = 'workflowPostPublishSort';
type PostPublishSectionNavKey = 'overview' | UsedGearWorkflowPostPublishBucket;

function parsePostPublishSortMode(search: string): UsedGearWorkflowPostPublishSortMode {
  const value = new URLSearchParams(search).get(WORKFLOW_POST_PUBLISH_SORT_PARAM);
  return value === 'oldest-activity' || value === 'sku' ? value : 'latest-activity';
}

export function PostPublishQueueTab({
  currentUserName,
  onOpenOperationalRecord,
  onOpenListingsRecord,
}: PostPublishQueueTabProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const searchTerm = useMemo(() => new URLSearchParams(location.search).get(WORKFLOW_POST_PUBLISH_SEARCH_PARAM) ?? '', [location.search]);
  const sortMode = useMemo(() => parsePostPublishSortMode(location.search), [location.search]);
  const focusedBucket = useMemo<UsedGearWorkflowPostPublishBucket | null>(() => {
    const bucket = new URLSearchParams(location.search).get('workflowPostPublishBucket');
    return bucket === 'active-listing' || bucket === 'stale-listing' || bucket === 'sold-ready' || bucket === 'shipped'
      ? bucket
      : null;
  }, [location.search]);

  const updateRouteState = useCallback((update: (params: URLSearchParams) => void) => {
    const nextParams = new URLSearchParams(location.search);
    update(nextParams);

    const nextSearch = nextParams.toString();
    navigate({
      pathname: location.pathname,
      search: nextSearch ? `?${nextSearch}` : '',
      hash: '#used-gear-post-publish',
    }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  const handleFocusedBucketChange = useCallback((bucket: UsedGearWorkflowPostPublishBucket | 'all') => {
    updateRouteState((params) => {
      if (bucket === 'all') {
        params.delete('workflowPostPublishBucket');
      } else {
        params.set('workflowPostPublishBucket', bucket);
      }
    });
  }, [updateRouteState]);

  const sectionItems = useMemo(() => [
    { id: POST_PUBLISH_OVERVIEW_SECTION_ID, key: 'overview' as const, label: 'Overview' },
    ...POST_PUBLISH_SECTION_DEFINITIONS.map((section) => ({ id: section.id, key: section.key, label: section.title })),
  ], []);
  const { activeSectionId, scrollToSection } = usePageSectionTracking(sectionItems, POST_PUBLISH_OVERVIEW_SECTION_ID);
  const activeSectionKey = useMemo<PostPublishSectionNavKey>(
    () => sectionItems.find((item) => item.id === activeSectionId)?.key ?? 'overview',
    [activeSectionId, sectionItems],
  );

  const handleSectionSelect = useCallback((sectionKey: PostPublishSectionNavKey) => {
    if (sectionKey === 'overview') {
      handleFocusedBucketChange('all');
      requestAnimationFrame(() => {
        scrollToSection(POST_PUBLISH_OVERVIEW_SECTION_ID);
      });
      return;
    }

    handleFocusedBucketChange(sectionKey);
    requestAnimationFrame(() => {
      scrollToSection(getPostPublishSectionId(sectionKey));
    });
  }, [handleFocusedBucketChange, scrollToSection]);

  return (
    <WorkflowQueuePageTemplate
      eyebrow="Follow-Through"
      title="Post-Publish"
    >
      <MainPageSectionNav
        ariaLabel="Post-publish sections"
        items={sectionItems.map((item) => ({ key: item.key, label: item.label }))}
        activeKey={activeSectionKey}
        onSelect={handleSectionSelect}
      />

      <UsedGearWorkflowPostPublishSection
        currentUserName={currentUserName}
        showSectionIntro={false}
        focusedBucket={focusedBucket}
        onOpenOperationalRecord={onOpenOperationalRecord}
        onOpenListingsRecord={onOpenListingsRecord}
        searchTerm={searchTerm}
        onSearchTermChange={(value) => updateRouteState((params) => {
          if (value.trim()) {
            params.set(WORKFLOW_POST_PUBLISH_SEARCH_PARAM, value);
          } else {
            params.delete(WORKFLOW_POST_PUBLISH_SEARCH_PARAM);
          }
        })}
        sortMode={sortMode}
        onSortModeChange={(value) => updateRouteState((params) => {
          if (value === 'latest-activity') {
            params.delete(WORKFLOW_POST_PUBLISH_SORT_PARAM);
          } else {
            params.set(WORKFLOW_POST_PUBLISH_SORT_PARAM, value);
          }
        })}
      />
    </WorkflowQueuePageTemplate>
  );
}