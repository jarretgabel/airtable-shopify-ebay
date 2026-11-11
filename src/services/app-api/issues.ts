import { getJson, patchJson, postJson } from './http';

export const ISSUE_KINDS = ['bug', 'feature', 'question'] as const;
export const ISSUE_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export const ISSUE_STATUSES = ['open', 'in_progress', 'blocked', 'resolved', 'closed', 'wont_fix'] as const;

export type IssueKind = (typeof ISSUE_KINDS)[number];
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number];
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export interface IssuePerson { name: string; email: string }

export interface Issue {
  id: number;
  kind: IssueKind;
  title: string;
  description: string;
  priority: IssuePriority;
  status: IssueStatus;
  area: string | null;
  pageUrl: string | null;
  source: 'app' | 'assistant';
  submittedBy: IssuePerson;
  assignedTo: IssuePerson | null;
  resolvedBy: IssuePerson | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
  imageCount: number;
}

export interface IssueImage { id: number; filename: string; url: string; uploadedBy: IssuePerson; createdAt: string }

export interface IssueDetail extends Issue {
  images: IssueImage[];
  comments: Array<{ id: number; author: IssuePerson; body: string; createdAt: string }>;
  events: Array<{ id: number; actor: IssuePerson; action: string; from: string | null; to: string | null; createdAt: string }>;
}

export interface IssueSummary {
  open: number;
  inProgress: number;
  blocked: number;
  resolvedLast7Days: number;
  total: number;
  openByAssignee: Array<{ name: string | null; email: string | null; open: number }>;
}

export interface IssueListResponse { issues: Issue[]; summary: IssueSummary; people: IssuePerson[]; me: IssuePerson }

export interface IssueListFilters { status?: string; kind?: string; assignee?: string; submitter?: string; q?: string }

export function listIssues(filters: IssueListFilters = {}): Promise<IssueListResponse> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
  const query = params.toString();
  return getJson<IssueListResponse>(`/api/issues${query ? `?${query}` : ''}`);
}

export function getIssue(id: number): Promise<{ issue: IssueDetail }> {
  return getJson<{ issue: IssueDetail }>(`/api/issues/${id}`);
}

export function createIssue(input: { kind: IssueKind; title: string; description: string; priority: IssuePriority; area?: string; pageUrl?: string }): Promise<{ issue: Issue }> {
  return postJson<{ issue: Issue }>('/api/issues', input);
}

export function updateIssue(id: number, update: { status?: IssueStatus; priority?: IssuePriority; assignedTo?: IssuePerson | null; resolutionNote?: string }): Promise<{ issue: IssueDetail }> {
  return patchJson<{ issue: IssueDetail }>(`/api/issues/${id}`, update);
}

export function addIssueComment(id: number, body: string): Promise<{ issue: IssueDetail }> {
  return postJson<{ issue: IssueDetail }>(`/api/issues/${id}/comments`, { body });
}

export function addIssueImage(id: number, image: { filename: string; data: string }): Promise<{ issue: IssueDetail }> {
  return postJson<{ issue: IssueDetail }>(`/api/issues/${id}/images`, image);
}
