import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getPostgresPool } from '../../db/pool.js';
import {
  ISSUE_KINDS, ISSUE_PRIORITIES, ISSUE_STATUSES, MAX_ISSUE_IMAGES, addIssueComment, addIssueImage, countIssueImages, createIssue, getIssue, getIssueSummary, listIssuePeople, listIssues, updateIssue,
  type IssueActor, type IssueKind, type IssuePriority, type IssueStatus, type IssueUpdate,
} from '../../db/issues.js';
import { randomUUID } from 'node:crypto';
import { getMediaStoreFromEnv } from '../../providers/media/mediaStore.js';
import { HttpError, getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError } from '../../shared/logging.js';

const SERVICE = 'issues';

function badRequest(message: string): HttpError {
  return new HttpError(400, message, { service: SERVICE, code: 'ISSUES_INVALID_REQUEST', retryable: false });
}

function text(value: unknown, label: string, max: number, required = false): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (required && !trimmed) throw badRequest(`${label} is required`);
  if (trimmed.length > max) throw badRequest(`${label} is too long`);
  return trimmed;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw badRequest(`${label} is not valid`);
  return value as T;
}

function body(event: APIGatewayProxyEventV2): Record<string, unknown> {
  const parsed = requireJsonBody<unknown>(event, SERVICE, 'ISSUES_INVALID_BODY');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw badRequest('Request body must be an object');
  return parsed as Record<string, unknown>;
}

const IMAGE_MAX_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES: Array<{ type: string; ext: string; matches: (b: Buffer) => boolean }> = [
  { type: 'image/jpeg', ext: 'jpg', matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: 'image/png', ext: 'png', matches: (b) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) },
  { type: 'image/gif', ext: 'gif', matches: (b) => b.subarray(0, 4).toString('latin1') === 'GIF8' },
  { type: 'image/webp', ext: 'webp', matches: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
];

function withImageUrls<T extends { images: Array<{ key: string }> }>(detail: T) {
  const media = getMediaStoreFromEnv();
  return { ...detail, images: detail.images.map((image) => ({ ...image, url: media ? media.publicUrl(image.key) : '' })) };
}

function issueId(event: APIGatewayProxyEventV2): number {
  const id = Number(event.pathParameters?.issueId);
  if (!Number.isInteger(id) || id < 1) throw badRequest('Issue id is not valid');
  return id;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    const user = await requireRouteAccess(event, { anyPage: ['issues'] });
    if (!process.env.DATABASE_URL?.trim()) {
      throw new HttpError(503, 'Issue tracking needs the Postgres database, which is not configured.', { service: SERVICE, code: 'POSTGRES_NOT_CONFIGURED', retryable: false });
    }
    const db = getPostgresPool();
    const me: IssueActor = { name: user.name, email: user.email };
    const route = event.routeKey;

    if (route === 'GET /api/issues') {
      const query = event.queryStringParameters ?? {};
      const status = query.status === 'open_all' ? 'open_all' : ISSUE_STATUSES.includes(query.status as IssueStatus) ? (query.status as IssueStatus) : null;
      const kind = ISSUE_KINDS.includes(query.kind as IssueKind) ? (query.kind as IssueKind) : null;
      const issues = await listIssues(db, {
        status,
        kind,
        search: query.q?.slice(0, 100),
        assignedTo: query.assignee === 'me' ? me.email : query.assignee || null,
        submittedBy: query.submitter === 'me' ? me.email : query.submitter || null,
      });
      return jsonOk({ issues, summary: await getIssueSummary(db), people: await listIssuePeople(db), me }, { origin });
    }

    if (route === 'POST /api/issues') {
      const input = body(event);
      const issue = await createIssue(db, {
        kind: oneOf(input.kind ?? 'bug', ISSUE_KINDS, 'kind'),
        title: text(input.title, 'Title', 200, true),
        description: text(input.description, 'Description', 5000),
        priority: oneOf(input.priority ?? 'normal', ISSUE_PRIORITIES, 'priority'),
        area: text(input.area, 'Area', 100) || null,
        pageUrl: text(input.pageUrl, 'Page', 300) || null,
      }, me);
      return jsonOk({ issue }, { origin });
    }

    if (route === 'GET /api/issues/{issueId}') {
      const issue = await getIssue(db, issueId(event));
      if (!issue) throw new HttpError(404, 'Issue not found', { service: SERVICE, code: 'ISSUES_NOT_FOUND', retryable: false });
      return jsonOk({ issue: withImageUrls(issue) }, { origin });
    }

    if (route === 'PATCH /api/issues/{issueId}') {
      const input = body(event);
      const update: IssueUpdate = {};
      if (input.status !== undefined) update.status = oneOf(input.status, ISSUE_STATUSES, 'status');
      if (input.priority !== undefined) update.priority = oneOf(input.priority, ISSUE_PRIORITIES, 'priority');
      if (input.resolutionNote !== undefined) update.resolutionNote = text(input.resolutionNote, 'Resolution note', 2000) || null;
      if (input.assignedTo !== undefined) {
        const assignee = input.assignedTo as { name?: unknown; email?: unknown } | null;
        update.assignedTo = assignee ? { name: text(assignee.name, 'Assignee name', 120, true), email: text(assignee.email, 'Assignee email', 200, true) } : null;
      }
      const issue = await updateIssue(db, issueId(event), update, me);
      if (!issue) throw new HttpError(404, 'Issue not found', { service: SERVICE, code: 'ISSUES_NOT_FOUND', retryable: false });
      return jsonOk({ issue: withImageUrls(issue) }, { origin });
    }

    if (route === 'POST /api/issues/{issueId}/comments') {
      const id = issueId(event);
      if (!(await addIssueComment(db, id, text(body(event).body, 'Comment', 3000, true), me))) {
        throw new HttpError(404, 'Issue not found', { service: SERVICE, code: 'ISSUES_NOT_FOUND', retryable: false });
      }
      return jsonOk({ issue: withImageUrls((await getIssue(db, id))!) }, { origin });
    }

    if (route === 'POST /api/issues/{issueId}/images') {
      const id = issueId(event);
      const input = body(event);
      const media = getMediaStoreFromEnv();
      if (!media) throw new HttpError(503, 'Image storage is not configured.', { service: SERVICE, code: 'MEDIA_NOT_CONFIGURED', retryable: false });
      const data = typeof input.data === 'string' ? Buffer.from(input.data, 'base64') : Buffer.alloc(0);
      if (data.length === 0) throw badRequest('Image data is required');
      if (data.length > IMAGE_MAX_BYTES) throw badRequest('Image is too large (4 MB maximum)');
      const kind = IMAGE_TYPES.find((candidate) => candidate.matches(data));
      if (!kind) throw badRequest('Only JPEG, PNG, GIF and WebP images are supported');
      const existing = await countIssueImages(db, id);
      if (existing === null) throw new HttpError(404, 'Issue not found', { service: SERVICE, code: 'ISSUES_NOT_FOUND', retryable: false });
      if (existing >= MAX_ISSUE_IMAGES) throw badRequest(`An issue can have at most ${MAX_ISSUE_IMAGES} images`);
      const key = `issues/${id}/${randomUUID()}.${kind.ext}`;
      await media.put(key, data, kind.type);
      await addIssueImage(db, id, { key, filename: text(input.filename, 'Filename', 200) || `screenshot.${kind.ext}`, contentType: kind.type, sizeBytes: data.length }, me);
      return jsonOk({ issue: withImageUrls((await getIssue(db, id))!) }, { origin });
    }

    throw new HttpError(404, 'Not found', { service: SERVICE, code: 'ISSUES_NOT_FOUND', retryable: false });
  } catch (error) {
    logError('Issue tracker request failed', error);
    return jsonError(getStatusCode(error), toApiErrorBody(SERVICE, error, 'ISSUES_FAILED'), { origin });
  }
}
