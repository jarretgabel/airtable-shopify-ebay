import { KNOWLEDGE_CHUNKS } from './knowledge.generated.js';
import { logError } from '../../../shared/logging.js';
import type { AssistantScope } from './scope.js';

export interface KnowledgeChunk {
  id: string;
  source: string;
  title: string;
  text: string;
  /** all: every role; workflow: roles that can open the Workflow Hub; full-access: admin, owner, developer. */
  audience: 'all' | 'full-access' | 'workflow';
  roles?: string[];
  pages?: string[];
}

const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'is', 'are', 'do', 'does', 'how', 'what', 'i', 'my', 'it', 'this', 'that', 'with', 'be', 'can', 'where', 'when']);
const MAX_RESULTS = 4;
const MAX_TEXT = 1600;

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

export function isChunkVisible(scope: AssistantScope, chunk: KnowledgeChunk): boolean {
  if (scope.fullAccess) return true;
  if (chunk.roles && !chunk.roles.includes(scope.role)) return false;
  if (chunk.audience === 'full-access') return false;
  if (chunk.audience === 'workflow' && !scope.pages.includes('inventory')) return false;
  if (chunk.pages && chunk.pages.length > 0 && !chunk.pages.some((page) => scope.pages.includes(page))) return false;
  return true;
}

export function searchKnowledge(
  scope: AssistantScope,
  query: string,
  chunks: KnowledgeChunk[] = KNOWLEDGE_CHUNKS,
): Array<{ source: string; title: string; text: string }> {
  const terms = [...new Set(tokenize(query))];
  if (terms.length === 0) return [];

  return chunks
    .filter((chunk) => isChunkVisible(scope, chunk))
    .map((chunk) => {
      const title = tokenize(chunk.title);
      const body = tokenize(chunk.text);
      let score = 0;
      for (const term of terms) {
        if (title.includes(term)) score += 3;
        const hits = body.filter((word) => word === term).length;
        score += Math.min(hits, 3);
      }
      return { chunk, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map(({ chunk }) => ({ source: chunk.source, title: chunk.title, text: chunk.text.slice(0, MAX_TEXT) }));
}

const GUIDE_CACHE_MS = 5 * 60 * 1000;
const GUIDE_META_FIELDS = new Set(['Name', 'Content Key', 'Content Type', 'Sort Order', 'Last Seeded At', 'Role']);
let guideCache: { at: number; chunks: KnowledgeChunk[] } | null = null;

function guideText(fields: Record<string, unknown>): string {
  return Object.entries(fields)
    .filter(([name, value]) => !GUIDE_META_FIELDS.has(name) && !/^Page \d+$/.test(name) && typeof value === 'string' && value.trim())
    .map(([name, value]) => `${name}: ${String(value).trim()}`)
    .join('\n');
}

/** Turns the editable user-guide records (Postgres) into searchable chunks scoped by their role and page fields. */
export function guideRecordsToChunks(records: Array<{ id: string; fields: Record<string, unknown> }>): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  for (const record of records) {
    const { fields } = record;
    const type = String(fields['Content Type'] ?? '');
    const text = guideText(fields);
    if (!text) continue;
    const role = typeof fields.Role === 'string' && fields.Role.trim() ? [fields.Role.trim()] : undefined;
    const pages = type === 'page-guide'
      ? Object.entries(fields).filter(([name, value]) => /^Page \d+$/.test(name) && typeof value === 'string').map(([, value]) => String(value))
      : undefined;
    chunks.push({
      id: `guide:${record.id}`,
      source: `User guide (${type})`,
      title: String(fields.Name ?? type),
      text,
      audience: 'all',
      ...(role && (type === 'role-guide' || type === 'role-start-point') ? { roles: role } : {}),
      ...(pages && pages.length > 0 ? { pages } : {}),
    });
  }
  return chunks;
}

async function loadGuideChunks(): Promise<KnowledgeChunk[]> {
  if (guideCache && Date.now() - guideCache.at < GUIDE_CACHE_MS) return guideCache.chunks;
  let chunks: KnowledgeChunk[] = [];
  try {
    const { getConfiguredRecords } = await import('../../../store/index.js');
    chunks = guideRecordsToChunks(await getConfiguredRecords('user-guide', { maxRecords: 500 }));
  } catch (error) {
    logError('Assistant user guide load failed', error);
  }
  guideCache = { at: Date.now(), chunks };
  return chunks;
}

/** Searches the live user guide plus the bundled repo docs. */
export async function searchAllKnowledge(scope: AssistantScope, query: string) {
  return searchKnowledge(scope, query, [...await loadGuideChunks(), ...KNOWLEDGE_CHUNKS]);
}
