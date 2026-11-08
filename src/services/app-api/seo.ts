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

export interface SeoSummary {
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
}

export function getSeoSummary(): Promise<SeoSummary> {
  return getJson<SeoSummary>('/api/seo/summary');
}

export function startSeoAudit(): Promise<{ started: boolean; reason?: string }> {
  return postJson<{ started: boolean; reason?: string }>('/api/seo/audit', {});
}
