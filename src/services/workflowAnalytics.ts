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

const STORAGE_KEY = 'workflow_analytics_events';
const STORAGE_LIMIT = 250;

function isAnalyticsEnabled(): boolean {
  const raw = (import.meta.env.VITE_ANALYTICS_ENABLED as string | undefined)?.trim().toLowerCase();
  if (!raw) return true;
  return raw !== 'false' && raw !== '0' && raw !== 'off';
}

function getAnalyticsEndpoint(): string {
  return (import.meta.env.VITE_ANALYTICS_ENDPOINT as string | undefined)?.trim() ?? '';
}

function appendToLocalBuffer(event: WorkflowEvent): void {
  if (typeof window === 'undefined') return;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const events: WorkflowEvent[] = raw ? (JSON.parse(raw) as WorkflowEvent[]) : [];
    events.push(event);
    const bounded = events.slice(-STORAGE_LIMIT);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bounded));
  } catch {
    // Ignore storage failures in private mode / quota limits.
  }
}

function postToEndpoint(endpoint: string, event: WorkflowEvent): void {
  if (typeof window === 'undefined' || !endpoint) return;

  const body = JSON.stringify(event);
  const blob = new Blob([body], { type: 'application/json' });

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    navigator.sendBeacon(endpoint, blob);
    return;
  }

  void fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
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

  appendToLocalBuffer(event);

  if (import.meta.env.DEV) {
    console.info('[analytics]', event);
  }

  postToEndpoint(getAnalyticsEndpoint(), event);
}
