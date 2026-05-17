import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WorkflowQueuePageTemplate } from '@/components/app/WorkflowQueuePageTemplate';
import { UsedGearWorkflowPostPublishSection, type UsedGearWorkflowPostPublishSortMode } from '@/components/tabs/airtable/UsedGearWorkflowPostPublishSection';
import type { UsedGearWorkflowPostPublishBucket } from '@/services/usedGearWorkflowLifecycle';

interface PostPublishQueueTabProps {
  currentUserName: string;
  onOpenOperationalRecord: (recordId: string) => void;
  onOpenListingsRecord: (recordId: string) => void;
}

const WORKFLOW_POST_PUBLISH_SEARCH_PARAM = 'workflowPostPublishSearch';
const WORKFLOW_POST_PUBLISH_SORT_PARAM = 'workflowPostPublishSort';

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

  return (
    <WorkflowQueuePageTemplate
      eyebrow="Used Gear Workflow"
      title="Post-Publish"
    >
      <UsedGearWorkflowPostPublishSection
        currentUserName={currentUserName}
        showSectionIntro={false}
        focusedBucket={focusedBucket}
        onFocusedBucketChange={handleFocusedBucketChange}
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