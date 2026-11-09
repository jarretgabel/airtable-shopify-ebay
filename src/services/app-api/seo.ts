import { getJson, postJson } from './http';

export interface SeoIssue { id: string; kind: 'seo' | 'aio'; label: string; lost: number; detail?: string }
export interface SeoSiteCheck { id: string; label: string; pass: boolean; detail?: string }

export interface SeoPageRow {
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
  issues: SeoIssue[];
  lastModified: string | null;
  checkedAt: string;
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

export interface SeoCitationCheck { question: string; mentioned: boolean; cited: boolean; sources: string[]; answer: string; error: string | null }

export interface SeoCitationSummary {
  running: boolean;
  latestRun: { id: number; finishedAt: string | null; status: string; questionCount: number; mentionedCount: number; citedCount: number; error: string | null } | null;
  checks: SeoCitationCheck[];
  history: Array<{ finishedAt: string; questionCount: number; mentionedCount: number; citedCount: number }>;
}

export interface GscTotals { clicks: number; impressions: number; ctr: number; position: number | null }
export interface GscRow { clicks: number; impressions: number; ctr: number | null; position: number | null }

export interface SeoSearchConsole {
  syncedAt: string | null;
  error: string | null;
  rangeEnd: string | null;
  current: GscTotals;
  previous: GscTotals;
  daily: Array<{ day: string; clicks: number; impressions: number }>;
  queries: Array<GscRow & { query: string }>;
  pages: Array<GscRow & { url: string }>;
}

export interface SeoSummary {
  searchConsole: SeoSearchConsole | null;
  latestRun: {
    id: number;
    startedAt: string;
    finishedAt: string | null;
    status: string;
    pageCount: number;
    avgSeoScore: number | null;
    avgAioScore: number | null;
    siteChecks: SeoSiteCheck[];
  } | null;
  running: boolean;
  trend: Array<{ finishedAt: string; avgSeoScore: number | null; avgAioScore: number | null; pageCount: number }>;
  byType: Array<{ pageType: string; pages: number; avgSeoScore: number; avgAioScore: number }>;
  topIssues: Array<{ id: string; kind: string; label: string; pages: number; pointsLost: number }>;
  pages: SeoPageRow[];
  pagesTruncated: boolean;
  pageSpeed: SeoPageSpeedRow[];
  citations: SeoCitationSummary;
}

export type SeoSiteId = 'resolutionav' | 'stereobuyers';

export function getSeoSummary(site: SeoSiteId = 'resolutionav'): Promise<SeoSummary> {
  return getJson<SeoSummary>(`/api/seo/summary?site=${site}`);
}

export function startSeoAudit(task: 'audit' | 'citations' = 'audit', site: SeoSiteId = 'resolutionav'): Promise<{ started: boolean; reason?: string }> {
  return postJson<{ started: boolean; reason?: string }>('/api/seo/audit', { task, site });
}
