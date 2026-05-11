import { checkOptionalEnv } from '@/config/runtimeEnv';
import { postJson } from '@/services/app-api/http';

export type WorkflowEventName =
  | 'tab_viewed'
  | 'data_refreshed'
  | 'pdf_exported'
  | 'approval_record_opened'
  | 'approval_saved'
  | 'approval_approved'
  | 'approval_queue_refreshed'
  | 'approval_queue_filtered'
  | 'shopify_draft_created_from_approval'
  | 'shopify_draft_create_failed_from_approval';

interface WorkflowEventPayload {
  [key: string]: string | number | boolean | null | undefined;
}

interface WorkflowEvent {
  name: WorkflowEventName;
  at: string;
  payload: WorkflowEventPayload;
}

const ANALYTICS_API_PATH = '/api/analytics/events';

function isAnalyticsEnabled(): boolean {
  const raw = checkOptionalEnv('VITE_ANALYTICS_ENABLED').toLowerCase();
  if (!raw) return true;
  return raw !== 'false' && raw !== '0' && raw !== 'off';
}

function postToEndpoint(event: WorkflowEvent): void {
  if (typeof window === 'undefined') return;

  void postJson<{ accepted: boolean }>(ANALYTICS_API_PATH, event).catch(() => {
    // Ignore network failures in non-blocking analytics path.
  });
}

export function trackWorkflowEvent(name: WorkflowEventName, payload: WorkflowEventPayload = {}): void {
  if (!isAnalyticsEnabled()) return;

  const event: WorkflowEvent = {
    name,
    at: new Date().toISOString(),
    payload,
  };

  if (import.meta.env.DEV) {
    console.info('[analytics]', event);
  }

  postToEndpoint(event);
}
