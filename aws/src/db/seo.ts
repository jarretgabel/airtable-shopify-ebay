import type { Queryable } from './sellersSummary.js';
import type { AuditIssue } from '../seo/scoring.js';
import type { SiteCheck } from '../seo/siteChecks.js';
import { DEFAULT_SEO_SITE, type SeoSiteId } from '../seo/sites.js';

export interface SeoPageRecord {
  url: string;
  pageType: string;
  statusCode: number | null;
  responseMs: number | null;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  canonical: string | null;
  wordCount: number | null;
  schemaTypes: string[];
  seoScore: number;
  aioScore: number;
  issues: AuditIssue[];
  lastModified: string | null;
}

export interface SeoRunSummary {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  pageCount: number;
  avgSeoScore: number | null;
  avgAioScore: number | null;
  siteChecks: SiteCheck[];
}

export interface SeoPageSpeedRow {
  url: string;
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
  lcpMs: number | null;
  fcpMs: number | null;
  tbtMs: number | null;
  cls: number | null;
  error: string | null;
  checkedAt: string;
}

export interface SeoCitationCheck {
  question: string;
  mentioned: boolean;
  cited: boolean;
  sources: string[];
  answer: string;
  error: string | null;
}

export interface SeoCitationSummary {
  running: boolean;
  latestRun: { id: number; finishedAt: string | null; status: string; questionCount: number; mentionedCount: number; citedCount: number; error: string | null } | null;
  checks: SeoCitationCheck[];
  history: Array<{ finishedAt: string; questionCount: number; mentionedCount: number; citedCount: number }>;
}

export interface SeoSummary {
  latestRun: SeoRunSummary | null;
  running: boolean;
  trend: Array<{ finishedAt: string; avgSeoScore: number | null; avgAioScore: number | null; pageCount: number }>;
  byType: Array<{ pageType: string; pages: number; avgSeoScore: number; avgAioScore: number }>;
  topIssues: Array<{ id: string; kind: string; label: string; pages: number; pointsLost: number }>;
  pages: Array<SeoPageRecord & { checkedAt: string }>;
  pagesTruncated: boolean;
  pageSpeed: SeoPageSpeedRow[];
  citations: SeoCitationSummary;
}

export const SEO_PAGES_MAX_ROWS = 500;
const STALE_RUN_MINUTES = 20;

const num = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));
const iso = (value: unknown): string | null => (value ? new Date(value as string).toISOString() : null);

/** Marks runs that never finished (a crashed Lambda) as failed, then returns whether a live run exists. */
export async function hasActiveRun(db: Queryable, site: SeoSiteId = DEFAULT_SEO_SITE): Promise<boolean> {
  await db.query(
    `UPDATE seo_audit_runs SET status = 'failed', finished_at = now(), error = 'Run did not finish'
     WHERE status = 'running' AND started_at < now() - ($1 || ' minutes')::interval`,
    [String(STALE_RUN_MINUTES)],
  );
  const result = await db.query(`SELECT 1 FROM seo_audit_runs WHERE status = 'running' AND site = $1 LIMIT 1`, [site]);
  return result.rows.length > 0;
}

export async function startRun(db: Queryable, site: SeoSiteId = DEFAULT_SEO_SITE): Promise<number> {
  const result = await db.query(`INSERT INTO seo_audit_runs (site) VALUES ($1) RETURNING id`, [site]);
  return Number(result.rows[0].id);
}

export async function upsertPage(db: Queryable, runId: number, page: SeoPageRecord, site: SeoSiteId = DEFAULT_SEO_SITE): Promise<void> {
  await db.query(
    `INSERT INTO seo_pages (url, page_type, status_code, response_ms, title, meta_description, h1, canonical, word_count, schema_types, seo_score, aio_score, issues, last_modified, checked_at, run_id, site)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,now(),$15,$16)
     ON CONFLICT (url) DO UPDATE SET
       page_type = EXCLUDED.page_type, status_code = EXCLUDED.status_code, response_ms = EXCLUDED.response_ms, title = EXCLUDED.title,
       meta_description = EXCLUDED.meta_description, h1 = EXCLUDED.h1, canonical = EXCLUDED.canonical, word_count = EXCLUDED.word_count,
       schema_types = EXCLUDED.schema_types, seo_score = EXCLUDED.seo_score, aio_score = EXCLUDED.aio_score, issues = EXCLUDED.issues,
       last_modified = EXCLUDED.last_modified, checked_at = now(), run_id = EXCLUDED.run_id, site = EXCLUDED.site`,
    [page.url, page.pageType, page.statusCode, page.responseMs, page.title, page.metaDescription, page.h1, page.canonical, page.wordCount,
      page.schemaTypes, page.seoScore, page.aioScore, JSON.stringify(page.issues), page.lastModified, runId, site],
  );
}

export async function finishRun(
  db: Queryable,
  runId: number,
  outcome: { status: 'completed' | 'partial' | 'failed'; siteChecks: SiteCheck[]; error?: string },
): Promise<void> {
  const averages = await db.query(
    `SELECT count(*)::int AS pages, round(avg(seo_score), 1)::float AS seo, round(avg(aio_score), 1)::float AS aio FROM seo_pages WHERE run_id = $1 AND status_code = 200`,
    [runId],
  );
  const row = averages.rows[0] ?? {};
  await db.query(
    `UPDATE seo_audit_runs SET status = $2, finished_at = now(), page_count = $3, avg_seo_score = $4, avg_aio_score = $5, site_checks = $6::jsonb, error = $7 WHERE id = $1`,
    [runId, outcome.status, Number(row.pages ?? 0), num(row.seo), num(row.aio), JSON.stringify(outcome.siteChecks), outcome.error ?? null],
  );
  // Only a full crawl may drop pages that left the sitemap.
  if (outcome.status === 'completed') await db.query(`DELETE FROM seo_pages WHERE site = (SELECT site FROM seo_audit_runs WHERE id = $1) AND run_id IS DISTINCT FROM $1`, [runId]);
}

function toRun(row: Record<string, unknown>): SeoRunSummary {
  return {
    id: Number(row.id),
    startedAt: iso(row.started_at) ?? '',
    finishedAt: iso(row.finished_at),
    status: String(row.status),
    pageCount: Number(row.page_count ?? 0),
    avgSeoScore: num(row.avg_seo_score),
    avgAioScore: num(row.avg_aio_score),
    siteChecks: (row.site_checks as SiteCheck[]) ?? [],
  };
}

export async function getPageSpeed(db: Queryable, site: SeoSiteId = DEFAULT_SEO_SITE): Promise<SeoPageSpeedRow[]> {
  const result = await db.query(`SELECT * FROM seo_pagespeed WHERE strategy = 'mobile' AND url IN (SELECT url FROM seo_pages WHERE site = $1) ORDER BY performance ASC NULLS LAST, url`, [site]);
  return result.rows.map((row) => ({
    url: String(row.url),
    performance: num(row.performance),
    accessibility: num(row.accessibility),
    bestPractices: num(row.best_practices),
    seo: num(row.seo),
    lcpMs: num(row.lcp_ms),
    fcpMs: num(row.fcp_ms),
    tbtMs: num(row.tbt_ms),
    cls: num(row.cls),
    error: (row.error as string | null) ?? null,
    checkedAt: iso(row.checked_at) ?? '',
  }));
}

export async function getCitationSummary(db: Queryable, site: SeoSiteId = DEFAULT_SEO_SITE): Promise<SeoCitationSummary> {
  const active = await db.query(`SELECT 1 FROM seo_citation_runs WHERE site = $1 AND status = 'running' AND started_at > now() - interval '20 minutes' LIMIT 1`, [site]);
  const latest = await db.query(`SELECT * FROM seo_citation_runs WHERE site = $1 AND status IN ('completed', 'failed') ORDER BY id DESC LIMIT 1`, [site]);
  const history = await db.query(
    `SELECT finished_at, question_count, mentioned_count, cited_count FROM (
       SELECT * FROM seo_citation_runs WHERE site = $1 AND status = 'completed' ORDER BY id DESC LIMIT 12
     ) recent ORDER BY id`,
    [site],
  );
  const run = latest.rows[0];
  const checks = run ? await db.query(`SELECT question, mentioned, cited, sources, answer, error FROM seo_citation_checks WHERE run_id = $1 ORDER BY id`, [run.id]) : { rows: [] };
  return {
    running: active.rows.length > 0,
    latestRun: run ? { id: Number(run.id), finishedAt: iso(run.finished_at), status: String(run.status), questionCount: Number(run.question_count), mentionedCount: Number(run.mentioned_count), citedCount: Number(run.cited_count), error: (run.error as string | null) ?? null } : null,
    checks: checks.rows.map((row) => ({ question: String(row.question), mentioned: Boolean(row.mentioned), cited: Boolean(row.cited), sources: (row.sources as string[]) ?? [], answer: String(row.answer ?? ''), error: (row.error as string | null) ?? null })),
    history: history.rows.map((row) => ({ finishedAt: iso(row.finished_at) ?? '', questionCount: Number(row.question_count), mentionedCount: Number(row.mentioned_count), citedCount: Number(row.cited_count) })),
  };
}

export interface AssistantSeoQuery {
  site?: SeoSiteId;
  pageType?: string | null;
  urlContains?: string | null;
  sortBy?: 'seo' | 'aio' | 'combined';
  limit?: number;
}

/** Lowest-scoring pages first, for the assistant's SEO questions. */
export async function queryPagesForAssistant(db: Queryable, query: AssistantSeoQuery) {
  const order = query.sortBy === 'seo' ? 'seo_score' : query.sortBy === 'aio' ? 'aio_score' : '(seo_score + aio_score)';
  const result = await db.query(
    `SELECT url, page_type, seo_score, aio_score, word_count, issues FROM seo_pages
     WHERE site = $4 AND status_code = 200 AND ($1::text IS NULL OR page_type = $1) AND ($2::text IS NULL OR url ILIKE '%' || $2 || '%')
     ORDER BY ${order}, url LIMIT $3`,
    [query.pageType || null, query.urlContains || null, Math.min(Math.max(query.limit ?? 10, 1), 25), query.site ?? DEFAULT_SEO_SITE],
  );
  return result.rows.map((row) => ({
    url: String(row.url),
    pageType: String(row.page_type),
    seoScore: Number(row.seo_score ?? 0),
    aioScore: Number(row.aio_score ?? 0),
    wordCount: num(row.word_count),
    topImprovements: ((row.issues as AuditIssue[]) ?? []).slice(0, 4).map((issue) => ({ kind: issue.kind, id: issue.id, label: issue.label, pointsGain: issue.lost, detail: issue.detail })),
  }));
}

export async function getSeoSummary(db: Queryable, filters: { pageType?: string | null; includePages?: boolean; site?: SeoSiteId } = {}): Promise<SeoSummary> {
  const site = filters.site ?? DEFAULT_SEO_SITE;
  const latest = await db.query(`SELECT * FROM seo_audit_runs WHERE site = $1 AND status IN ('completed', 'partial') ORDER BY id DESC LIMIT 1`, [site]);
  const active = await db.query(`SELECT 1 FROM seo_audit_runs WHERE site = $2 AND status = 'running' AND started_at > now() - ($1 || ' minutes')::interval LIMIT 1`, [String(STALE_RUN_MINUTES), site]);
  const trend = await db.query(
    `SELECT finished_at, avg_seo_score, avg_aio_score, page_count FROM (
       SELECT * FROM seo_audit_runs WHERE site = $1 AND status IN ('completed', 'partial') ORDER BY id DESC LIMIT 12
     ) recent ORDER BY id`,
    [site],
  );
  const byType = await db.query(
    `SELECT page_type, count(*)::int AS pages, round(avg(seo_score))::int AS seo, round(avg(aio_score))::int AS aio FROM seo_pages WHERE site = $1 AND status_code = 200 GROUP BY page_type ORDER BY pages DESC`,
    [site],
  );
  const topIssues = await db.query(
    `SELECT issue->>'id' AS id, issue->>'kind' AS kind, min(issue->>'label') AS label, count(*)::int AS pages, round(sum((issue->>'lost')::numeric), 0)::int AS lost
     FROM seo_pages, jsonb_array_elements(issues) AS issue WHERE site = $1 AND status_code = 200
     GROUP BY 1, 2 ORDER BY lost DESC LIMIT 12`,
    [site],
  );
  const type = filters.pageType?.trim() || null;
  const pages = filters.includePages === false ? { rows: [] } : await db.query(
    `SELECT url, page_type, status_code, response_ms, title, meta_description, h1, canonical, word_count, schema_types, seo_score, aio_score, issues, last_modified, checked_at
     FROM seo_pages WHERE site = $3 AND ($1::text IS NULL OR page_type = $1) ORDER BY (seo_score + aio_score), url LIMIT $2`,
    [type, SEO_PAGES_MAX_ROWS + 1, site],
  );
  const truncated = pages.rows.length > SEO_PAGES_MAX_ROWS;

  return {
    latestRun: latest.rows[0] ? toRun(latest.rows[0]) : null,
    running: active.rows.length > 0,
    trend: trend.rows.map((row) => ({ finishedAt: iso(row.finished_at) ?? '', avgSeoScore: num(row.avg_seo_score), avgAioScore: num(row.avg_aio_score), pageCount: Number(row.page_count ?? 0) })),
    byType: byType.rows.map((row) => ({ pageType: String(row.page_type), pages: Number(row.pages), avgSeoScore: Number(row.seo), avgAioScore: Number(row.aio) })),
    topIssues: topIssues.rows.map((row) => ({ id: String(row.id), kind: String(row.kind), label: String(row.label), pages: Number(row.pages), pointsLost: Number(row.lost) })),
    pages: pages.rows.slice(0, SEO_PAGES_MAX_ROWS).map((row) => ({
      url: String(row.url),
      pageType: String(row.page_type),
      statusCode: num(row.status_code),
      responseMs: num(row.response_ms),
      title: (row.title as string | null) ?? null,
      metaDescription: (row.meta_description as string | null) ?? null,
      h1: (row.h1 as string | null) ?? null,
      canonical: (row.canonical as string | null) ?? null,
      wordCount: num(row.word_count),
      schemaTypes: (row.schema_types as string[]) ?? [],
      seoScore: Number(row.seo_score ?? 0),
      aioScore: Number(row.aio_score ?? 0),
      issues: (row.issues as AuditIssue[]) ?? [],
      lastModified: row.last_modified ? String(row.last_modified).slice(0, 10) : null,
      checkedAt: iso(row.checked_at) ?? '',
    })),
    pagesTruncated: truncated,
    pageSpeed: await getPageSpeed(db, site),
    citations: await getCitationSummary(db, site),
  };
}
