import { HttpError } from '../../../shared/errors.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

interface UserUsage {
  requests: number[];
  tokens: number;
  dayStart: number;
}

// Per-instance memory: a best-effort guard. The function's reserved concurrency in template.yaml bounds the number of instances.
const usageByUser = new Map<string, UserUsage>();
const MAX_TRACKED_USERS = 1000;

function readLimit(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getAssistantLimits() {
  return {
    requestsPerMinute: readLimit('ASSISTANT_REQUESTS_PER_MINUTE', 12),
    dailyTokens: readLimit('ASSISTANT_DAILY_TOKEN_CAP', 300_000),
  };
}

function tooMany(message: string, code: string): HttpError {
  return new HttpError(429, message, { service: 'ai', code, retryable: true });
}

function getUsage(userId: string, now: number): UserUsage {
  let usage = usageByUser.get(userId);
  if (!usage) {
    if (usageByUser.size >= MAX_TRACKED_USERS) usageByUser.clear();
    usage = { requests: [], tokens: 0, dayStart: now };
    usageByUser.set(userId, usage);
  }
  if (now - usage.dayStart >= DAY_MS) {
    usage.tokens = 0;
    usage.dayStart = now;
  }
  usage.requests = usage.requests.filter((time) => now - time < MINUTE_MS);
  return usage;
}

/** Throws a 429 when the user is sending too fast or has used their daily token budget; otherwise counts the request. */
export function enforceAssistantLimits(userId: string, now = Date.now()): void {
  const limits = getAssistantLimits();
  const usage = getUsage(userId, now);
  if (usage.requests.length >= limits.requestsPerMinute) {
    throw tooMany('You are sending messages too quickly. Please wait a moment.', 'AI_ASSISTANT_RATE_LIMITED');
  }
  if (usage.tokens >= limits.dailyTokens) {
    throw tooMany('You have reached the assistant daily usage limit. Try again tomorrow.', 'AI_ASSISTANT_DAILY_LIMIT');
  }
  usage.requests.push(now);
}

export function recordAssistantTokens(userId: string, tokens: number, now = Date.now()): void {
  if (tokens > 0) getUsage(userId, now).tokens += tokens;
}

export function resetAssistantLimitsForTests(): void {
  usageByUser.clear();
}

interface SharedPool {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
}

async function defaultPool(): Promise<SharedPool | null> {
  if (!process.env.DATABASE_URL) return null;
  const { getPostgresPool } = await import('../../../db/pool.js');
  return getPostgresPool();
}

/**
 * Enforces the same limits using Postgres so they hold across Lambda instances and cold starts.
 * Returns the usage row id (to attach tokens later), or null when the database is unavailable,
 * in which case the in-memory guard alone applies.
 */
export async function enforceSharedAssistantLimits(userId: string, pool?: SharedPool | null, role?: string): Promise<number | null> {
  const limits = getAssistantLimits();
  try {
    const db = pool === undefined ? await defaultPool() : pool;
    if (!db) return null;
    const { rows } = await db.query(
      `SELECT count(*) FILTER (WHERE at > now() - interval '1 minute')::int AS recent,
              coalesce(sum(tokens), 0)::bigint AS tokens
         FROM assistant_usage WHERE user_id = $1 AND at > now() - interval '24 hours'`,
      [userId],
    );
    if (Number(rows[0]?.recent ?? 0) >= limits.requestsPerMinute) {
      throw tooMany('You are sending messages too quickly. Please wait a moment.', 'AI_ASSISTANT_RATE_LIMITED');
    }
    if (Number(rows[0]?.tokens ?? 0) >= limits.dailyTokens) {
      throw tooMany('You have reached the assistant daily usage limit. Try again tomorrow.', 'AI_ASSISTANT_DAILY_LIMIT');
    }
    const inserted = await db.query('INSERT INTO assistant_usage (user_id, role) VALUES ($1, $2) RETURNING id', [userId, role ?? null]);
    // Kept long enough for the usage view; the limits only look at the last 24 hours.
    await db.query(`DELETE FROM assistant_usage WHERE user_id = $1 AND at < now() - interval '45 days'`, [userId]);
    return Number(inserted.rows[0]?.id);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    return null;
  }
}

export async function recordSharedAssistantTokens(
  usageId: number | null,
  tokens: number,
  pool?: SharedPool | null,
  detail?: { inputTokens: number; outputTokens: number },
): Promise<void> {
  if (usageId === null || tokens <= 0) return;
  try {
    const db = pool === undefined ? await defaultPool() : pool;
    await db?.query('UPDATE assistant_usage SET tokens = $2, input_tokens = $3, output_tokens = $4 WHERE id = $1', [usageId, Math.round(tokens), Math.round(detail?.inputTokens ?? 0), Math.round(detail?.outputTokens ?? 0)]);
  } catch {
    // In-memory accounting still applies.
  }
}
