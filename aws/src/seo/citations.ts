import type { Queryable } from '../db/sellersSummary.js';
import { getOptionalSecret } from '../shared/secrets.js';
import { logError, logInfo } from '../shared/logging.js';
import { DEFAULT_SEO_SITE, parseSeoSite, SEO_SITES, type SeoSite, type SeoSiteId } from './sites.js';

const DEFAULT_MODEL = 'claude-haiku-4-5';
const MAX_SOURCES = 8;

/** Buyer-style questions an AI assistant might be asked; the last one checks plain brand awareness. */
export const CITATION_QUESTIONS = SEO_SITES.resolutionav.citationQuestions;

export interface CitationResult {
  question: string;
  mentioned: boolean;
  cited: boolean;
  sources: string[];
  answer: string;
  error: string | null;
}

export type CitationFetcher = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

interface AnswerBlock {
  type: string;
  text?: string;
  citations?: Array<{ url?: string }>;
  content?: unknown;
}

const hostOf = (url: string): string | null => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
};

/** Reads one web-search answer: the text, whether the brand is named, and which sites were cited. */
export function parseCitationAnswer(question: string, blocks: AnswerBlock[], site: SeoSite = SEO_SITES[DEFAULT_SEO_SITE]): CitationResult {
  const answer = blocks.filter((block) => block.type === 'text').map((block) => block.text ?? '').join('').trim();
  const urls: string[] = [];
  for (const block of blocks) {
    for (const citation of block.citations ?? []) if (citation.url) urls.push(citation.url);
    if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const result of block.content as Array<{ url?: string }>) if (result.url) urls.push(result.url);
    }
  }
  const hosts = [...new Set(urls.map(hostOf).filter((host): host is string => !!host))];
  const cited = hosts.some((host) => host === site.domain || host.endsWith(`.${site.domain}`));
  const sources = [...hosts].sort((a, b) => Number(b.endsWith(site.domain)) - Number(a.endsWith(site.domain))).slice(0, MAX_SOURCES);
  return { question, mentioned: site.brandPattern.test(answer), cited, sources, answer: answer.slice(0, 1500), error: null };
}

async function askWithSearch(question: string, apiKey: string, model: string, fetcher: CitationFetcher, site: SeoSite): Promise<CitationResult> {
  const response = await fetcher('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model,
      max_tokens: 900,
      system: 'You are a helpful shopping assistant. Search the web and recommend specific, named stores or sites. Be concise.',
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      messages: [{ role: 'user', content: question }],
    }),
  });
  if (!response.ok) {
    const hint = response.status === 400 || response.status === 403 ? ' (web search may need to be enabled for the Anthropic organisation)' : '';
    throw new Error(`Anthropic API error ${response.status}${hint}`);
  }
  const body = await response.json() as { content?: AnswerBlock[] };
  return parseCitationAnswer(question, body.content ?? [], site);
}

export interface CitationOptions {
  fetcher?: CitationFetcher;
  apiKey?: string | null;
  model?: string;
  questions?: string[];
  site?: SeoSiteId;
}

export async function startCitationRun(db: Queryable, site: SeoSiteId = DEFAULT_SEO_SITE): Promise<number> {
  const result = await db.query(`INSERT INTO seo_citation_runs (status, site) VALUES ('running', $1) RETURNING id`, [site]);
  return Number(result.rows[0].id);
}

export async function hasActiveCitationRun(db: Queryable, site: SeoSiteId = DEFAULT_SEO_SITE): Promise<boolean> {
  await db.query(`UPDATE seo_citation_runs SET status = 'failed', finished_at = now(), error = 'Run did not finish' WHERE status = 'running' AND started_at < now() - interval '20 minutes'`);
  const result = await db.query(`SELECT 1 FROM seo_citation_runs WHERE status = 'running' AND site = $1 LIMIT 1`, [site]);
  return result.rows.length > 0;
}

/** Asks each question with web search enabled and records whether the site is named or cited. */
export async function runCitationCheck(db: Queryable, runId: number, options: CitationOptions = {}): Promise<void> {
  const apiKey = options.apiKey ?? getOptionalSecret('ANTHROPIC_API_KEY');
  const model = options.model ?? getOptionalSecret('ANTHROPIC_MODEL') ?? DEFAULT_MODEL;
  const fetcher = options.fetcher ?? ((url, init) => fetch(url, init));
  const siteId = options.site ?? parseSeoSite((await db.query(`SELECT site FROM seo_citation_runs WHERE id = $1`, [runId])).rows[0]?.site);
  const site = SEO_SITES[siteId];
  const questions = options.questions ?? site.citationQuestions;
  let mentioned = 0;
  let cited = 0;
  let failures = 0;
  let attempted = 0;
  try {
    if (!apiKey) throw new Error('Anthropic API key is not configured');
    for (const question of questions) {
      let result: CitationResult;
      attempted += 1;
      try {
        result = await askWithSearch(question, apiKey, model, fetcher, site);
      } catch (error) {
        failures += 1;
        result = { question, mentioned: false, cited: false, sources: [], answer: '', error: error instanceof Error ? error.message : 'Check failed' };
      }
      if (result.mentioned) mentioned += 1;
      if (result.cited) cited += 1;
      await db.query(
        `INSERT INTO seo_citation_checks (run_id, question, mentioned, cited, sources, answer, error) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [runId, result.question, result.mentioned, result.cited, JSON.stringify(result.sources), result.answer, result.error],
      );
      // Stop early when the first questions all fail (bad key or web search not enabled).
      if (failures >= 2 && failures === attempted) break;
    }
    const status = failures === attempted ? 'failed' : 'completed';
    await db.query(`UPDATE seo_citation_runs SET status = $2, finished_at = now(), question_count = $3, mentioned_count = $4, cited_count = $5 WHERE id = $1`, [runId, status, attempted, mentioned, cited]);
    logInfo('Citation check finished', { runId, questions: attempted, mentioned, cited, failures });
  } catch (error) {
    logError('Citation check failed', error);
    await db.query(`UPDATE seo_citation_runs SET status = 'failed', finished_at = now(), error = $2 WHERE id = $1`, [runId, error instanceof Error ? error.message : 'Citation check failed']);
  }
}
