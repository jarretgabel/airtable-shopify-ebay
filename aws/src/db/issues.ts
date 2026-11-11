import type { Queryable } from './sellersSummary.js';

export const ISSUE_KINDS = ['bug', 'feature', 'question'] as const;
export const ISSUE_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export const ISSUE_STATUSES = ['open', 'in_progress', 'blocked', 'resolved', 'closed', 'wont_fix'] as const;
export const OPEN_STATUSES: readonly IssueStatus[] = ['open', 'in_progress', 'blocked'];

export type IssueKind = (typeof ISSUE_KINDS)[number];
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number];
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export interface IssueActor {
  name: string;
  email: string;
}

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
  submittedBy: IssueActor;
  assignedTo: IssueActor | null;
  resolvedBy: IssueActor | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
  imageCount: number;
}

export interface IssueImage { id: number; key: string; filename: string; contentType: string; sizeBytes: number; uploadedBy: IssueActor; createdAt: string }
export interface IssueComment { id: number; author: IssueActor; body: string; createdAt: string }
export interface IssueEvent { id: number; actor: IssueActor; action: string; from: string | null; to: string | null; createdAt: string }
export interface IssueDetail extends Issue { comments: IssueComment[]; events: IssueEvent[]; images: IssueImage[] }

export interface IssueFilters {
  status?: IssueStatus | 'open_all' | null;
  kind?: IssueKind | null;
  assignedTo?: string | null;
  submittedBy?: string | null;
  search?: string | null;
  limit?: number;
}

export interface IssueSummary {
  open: number;
  inProgress: number;
  blocked: number;
  resolvedLast7Days: number;
  total: number;
  /** Open issues per assignee; unassigned ones are grouped under null. */
  openByAssignee: Array<{ name: string | null; email: string | null; open: number }>;
}

const iso = (value: unknown): string => (value instanceof Date ? value : new Date(String(value))).toISOString();
const actor = (name: unknown, email: unknown): IssueActor | null => (name && email ? { name: String(name), email: String(email) } : null);

export function mapIssue(row: Record<string, unknown>): Issue {
  return {
    id: Number(row.id),
    kind: row.kind as IssueKind,
    title: String(row.title),
    description: String(row.description ?? ''),
    priority: row.priority as IssuePriority,
    status: row.status as IssueStatus,
    area: (row.area as string | null) ?? null,
    pageUrl: (row.page_url as string | null) ?? null,
    source: row.source === 'assistant' ? 'assistant' : 'app',
    submittedBy: actor(row.submitted_by_name, row.submitted_by_email) ?? { name: 'Unknown', email: '' },
    assignedTo: actor(row.assigned_to_name, row.assigned_to_email),
    resolvedBy: actor(row.resolved_by_name, row.resolved_by_email),
    resolvedAt: row.resolved_at ? iso(row.resolved_at) : null,
    resolutionNote: (row.resolution_note as string | null) ?? null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    imageCount: Number(row.image_count ?? 0),
  };
}

export async function createIssue(
  db: Queryable,
  input: { kind: IssueKind; title: string; description: string; priority: IssuePriority; area?: string | null; pageUrl?: string | null; source?: 'app' | 'assistant' },
  by: IssueActor,
): Promise<Issue> {
  const result = await db.query(
    `INSERT INTO issues (kind, title, description, priority, area, page_url, source, submitted_by_name, submitted_by_email)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [input.kind, input.title, input.description, input.priority, input.area || null, input.pageUrl || null, input.source ?? 'app', by.name, by.email],
  );
  const issue = mapIssue(result.rows[0]);
  await addEvent(db, issue.id, by, 'created', null, issue.status);
  return issue;
}

async function addEvent(db: Queryable, issueId: number, by: IssueActor, action: string, from: string | null, to: string | null): Promise<void> {
  await db.query(`INSERT INTO issue_events (issue_id, actor_name, actor_email, action, from_value, to_value) VALUES ($1, $2, $3, $4, $5, $6)`, [issueId, by.name, by.email, action, from, to]);
}

export async function listIssues(db: Queryable, filters: IssueFilters = {}): Promise<Issue[]> {
  const where: string[] = [];
  const values: unknown[] = [];
  const add = (clause: string, value: unknown) => { values.push(value); where.push(clause.replace('?', `$${values.length}`)); };
  if (filters.status === 'open_all') add('status = ANY(?)', [...OPEN_STATUSES]);
  else if (filters.status) add('status = ?', filters.status);
  if (filters.kind) add('kind = ?', filters.kind);
  if (filters.assignedTo) add('lower(assigned_to_email) = lower(?)', filters.assignedTo);
  if (filters.submittedBy) add('lower(submitted_by_email) = lower(?)', filters.submittedBy);
  const search = filters.search?.trim().replace(/^#/, '');
  if (search) {
    values.push(`%${search.replace(/[\\%_]/g, '\\$&')}%`, search);
    where.push(`(title ILIKE $${values.length - 1} OR description ILIKE $${values.length - 1} OR id::text = $${values.length})`);
  }
  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500);
  values.push(limit);
  const result = await db.query(
    `SELECT issues.*, (SELECT count(*) FROM issue_images WHERE issue_id = issues.id)::int AS image_count FROM issues ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY (status = ANY('{open,in_progress,blocked}')) DESC, CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, id DESC
     LIMIT $${values.length}`,
    values,
  );
  return result.rows.map(mapIssue);
}

export async function getIssue(db: Queryable, id: number): Promise<IssueDetail | null> {
  const issue = await db.query(`SELECT * FROM issues WHERE id = $1`, [id]);
  if (issue.rows.length === 0) return null;
  const comments = await db.query(`SELECT * FROM issue_comments WHERE issue_id = $1 ORDER BY id`, [id]);
  const events = await db.query(`SELECT * FROM issue_events WHERE issue_id = $1 ORDER BY id`, [id]);
  const images = await db.query(`SELECT * FROM issue_images WHERE issue_id = $1 ORDER BY id`, [id]);
  return {
    ...mapIssue({ ...issue.rows[0], image_count: images.rows.length }),
    images: images.rows.map((row) => ({ id: Number(row.id), key: String(row.storage_key), filename: String(row.filename), contentType: String(row.content_type), sizeBytes: Number(row.size_bytes), uploadedBy: actor(row.uploaded_by_name, row.uploaded_by_email) ?? { name: 'Unknown', email: '' }, createdAt: iso(row.created_at) })),
    comments: comments.rows.map((row) => ({ id: Number(row.id), author: actor(row.author_name, row.author_email) ?? { name: 'Unknown', email: '' }, body: String(row.body), createdAt: iso(row.created_at) })),
    events: events.rows.map((row) => ({ id: Number(row.id), actor: actor(row.actor_name, row.actor_email) ?? { name: 'Unknown', email: '' }, action: String(row.action), from: (row.from_value as string | null) ?? null, to: (row.to_value as string | null) ?? null, createdAt: iso(row.created_at) })),
  };
}

export interface IssueUpdate {
  status?: IssueStatus;
  priority?: IssuePriority;
  /** null unassigns; undefined leaves the assignee alone. */
  assignedTo?: IssueActor | null;
  resolutionNote?: string | null;
}

export async function updateIssue(db: Queryable, id: number, update: IssueUpdate, by: IssueActor): Promise<IssueDetail | null> {
  const current = await db.query(`SELECT * FROM issues WHERE id = $1`, [id]);
  if (current.rows.length === 0) return null;
  const before = mapIssue(current.rows[0]);
  const sets: string[] = ['updated_at = now()'];
  const values: unknown[] = [];
  const set = (column: string, value: unknown) => { values.push(value); sets.push(`${column} = $${values.length}`); };
  const events: Array<[string, string | null, string | null]> = [];

  if (update.status && update.status !== before.status) {
    set('status', update.status);
    events.push(['status', before.status, update.status]);
    if (OPEN_STATUSES.includes(update.status)) {
      sets.push('resolved_by_name = NULL', 'resolved_by_email = NULL', 'resolved_at = NULL');
    } else {
      set('resolved_by_name', by.name);
      set('resolved_by_email', by.email);
      sets.push('resolved_at = now()');
    }
  }
  if (update.priority && update.priority !== before.priority) {
    set('priority', update.priority);
    events.push(['priority', before.priority, update.priority]);
  }
  if (update.assignedTo !== undefined && update.assignedTo?.email.toLowerCase() !== before.assignedTo?.email.toLowerCase()) {
    set('assigned_to_name', update.assignedTo?.name ?? null);
    set('assigned_to_email', update.assignedTo?.email ?? null);
    events.push(['assignee', before.assignedTo?.name ?? null, update.assignedTo?.name ?? null]);
  }
  if (update.resolutionNote !== undefined && (update.resolutionNote || null) !== before.resolutionNote) {
    set('resolution_note', update.resolutionNote || null);
    events.push(['resolution note', null, null]);
  }
  if (events.length > 0) {
    values.push(id);
    await db.query(`UPDATE issues SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
    for (const [action, from, to] of events) await addEvent(db, id, by, action, from, to);
  }
  return getIssue(db, id);
}

export async function addIssueComment(db: Queryable, id: number, body: string, by: IssueActor): Promise<boolean> {
  const result = await db.query(`INSERT INTO issue_comments (issue_id, author_name, author_email, body) SELECT id, $2, $3, $4 FROM issues WHERE id = $1 RETURNING id`, [id, by.name, by.email, body]);
  if (result.rows.length === 0) return false;
  await db.query(`UPDATE issues SET updated_at = now() WHERE id = $1`, [id]);
  return true;
}

export async function getIssueSummary(db: Queryable): Promise<IssueSummary> {
  const counts = await db.query(
    `SELECT count(*) FILTER (WHERE status = 'open')::int AS open, count(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
            count(*) FILTER (WHERE status = 'blocked')::int AS blocked,
            count(*) FILTER (WHERE status IN ('resolved', 'closed') AND resolved_at > now() - interval '7 days')::int AS resolved_7d,
            count(*)::int AS total FROM issues`,
  );
  const byAssignee = await db.query(
    `SELECT assigned_to_name AS name, assigned_to_email AS email, count(*)::int AS open FROM issues
     WHERE status IN ('open', 'in_progress', 'blocked') GROUP BY 1, 2 ORDER BY open DESC, name`,
  );
  const row = counts.rows[0] ?? {};
  return {
    open: Number(row.open ?? 0),
    inProgress: Number(row.in_progress ?? 0),
    blocked: Number(row.blocked ?? 0),
    resolvedLast7Days: Number(row.resolved_7d ?? 0),
    total: Number(row.total ?? 0),
    openByAssignee: byAssignee.rows.map((r) => ({ name: (r.name as string | null) ?? null, email: (r.email as string | null) ?? null, open: Number(r.open) })),
  };
}

/** People who have submitted, been assigned or resolved issues, for the assignee picker. */
export async function listIssuePeople(db: Queryable): Promise<IssueActor[]> {
  const result = await db.query(
    `SELECT DISTINCT ON (lower(email)) name, email FROM (
       SELECT submitted_by_name AS name, submitted_by_email AS email FROM issues
       UNION ALL SELECT assigned_to_name, assigned_to_email FROM issues WHERE assigned_to_email IS NOT NULL
       UNION ALL SELECT resolved_by_name, resolved_by_email FROM issues WHERE resolved_by_email IS NOT NULL
       UNION ALL SELECT actor_name, actor_email FROM issue_events
     ) people ORDER BY lower(email), name`,
  );
  return result.rows.map((row) => ({ name: String(row.name), email: String(row.email) }));
}

export const MAX_ISSUE_IMAGES = 8;

export async function countIssueImages(db: Queryable, issueId: number): Promise<number | null> {
  const result = await db.query(`SELECT (SELECT count(*) FROM issue_images WHERE issue_id = i.id)::int AS n FROM issues i WHERE i.id = $1`, [issueId]);
  return result.rows.length === 0 ? null : Number(result.rows[0].n);
}

export async function addIssueImage(db: Queryable, issueId: number, image: { key: string; filename: string; contentType: string; sizeBytes: number }, by: IssueActor): Promise<void> {
  await db.query(
    `INSERT INTO issue_images (issue_id, storage_key, filename, content_type, size_bytes, uploaded_by_name, uploaded_by_email) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [issueId, image.key, image.filename, image.contentType, image.sizeBytes, by.name, by.email],
  );
  await db.query(`UPDATE issues SET updated_at = now() WHERE id = $1`, [issueId]);
  await addEvent(db, issueId, by, 'screenshot added', null, image.filename);
}
