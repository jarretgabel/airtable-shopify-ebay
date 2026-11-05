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
