import type { Queryable } from './sellersSummary.js';

export interface FeedbackInput {
  userId: string;
  role: string;
  rating: 'up' | 'down';
  question: string;
  answer: string;
  comment: string;
  tools: string[];
}

export async function saveAssistantFeedback(db: Queryable, input: FeedbackInput): Promise<void> {
  await db.query(
    `INSERT INTO assistant_feedback (user_id, role, rating, question, answer, comment, tools) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [input.userId, input.role, input.rating, input.question, input.answer, input.comment || null, JSON.stringify(input.tools)],
  );
}

export interface AssistantInsights {
  days: number;
  totals: { requests: number; inputTokens: number; outputTokens: number; estimatedCostUsd: number };
  daily: Array<{ day: string; requests: number; inputTokens: number; outputTokens: number; estimatedCostUsd: number }>;
  byRole: Array<{ role: string; requests: number; tokens: number; estimatedCostUsd: number }>;
  topUsers: Array<{ userId: string; role: string; requests: number; tokens: number }>;
  feedback: {
    up: number;
    down: number;
    recent: Array<{ id: number; rating: string; role: string | null; question: string; answer: string; comment: string | null; tools: string[]; at: string }>;
  };
}

export interface CostRates {
  inputPerMillion: number;
  outputPerMillion: number;
}

export function readCostRates(env: NodeJS.ProcessEnv = process.env): CostRates {
  const read = (name: string, fallback: number) => {
    const value = Number(env[name]);
    return Number.isFinite(value) && value >= 0 && env[name]?.trim() ? value : fallback;
  };
  // Defaults match Claude Haiku 4.5 list pricing (USD per million tokens).
  return { inputPerMillion: read('ASSISTANT_COST_INPUT_PER_MTOK', 1), outputPerMillion: read('ASSISTANT_COST_OUTPUT_PER_MTOK', 5) };
}

export const estimateCost = (inputTokens: number, outputTokens: number, rates: CostRates) =>
  Math.round(((inputTokens * rates.inputPerMillion + outputTokens * rates.outputPerMillion) / 1_000_000) * 10_000) / 10_000;

export async function getAssistantInsights(db: Queryable, rates: CostRates, days = 30): Promise<AssistantInsights> {
  const window = String(days);
  const daily = await db.query(
    `SELECT (at AT TIME ZONE 'UTC')::date AS day, count(*)::int AS requests, coalesce(sum(input_tokens), 0)::bigint AS input, coalesce(sum(output_tokens), 0)::bigint AS output
     FROM assistant_usage WHERE at > now() - ($1 || ' days')::interval GROUP BY 1 ORDER BY 1`,
    [window],
  );
  const byRole = await db.query(
    `SELECT coalesce(role, 'unknown') AS role, count(*)::int AS requests, coalesce(sum(input_tokens), 0)::bigint AS input, coalesce(sum(output_tokens), 0)::bigint AS output
     FROM assistant_usage WHERE at > now() - ($1 || ' days')::interval GROUP BY 1 ORDER BY requests DESC`,
    [window],
  );
  const users = await db.query(
    `SELECT user_id, max(role) AS role, count(*)::int AS requests, coalesce(sum(tokens), 0)::bigint AS tokens
     FROM assistant_usage WHERE at > now() - ($1 || ' days')::interval GROUP BY user_id ORDER BY tokens DESC LIMIT 10`,
    [window],
  );
  const counts = await db.query(
    `SELECT rating, count(*)::int AS n FROM assistant_feedback WHERE at > now() - ($1 || ' days')::interval GROUP BY rating`,
    [window],
  );
  const recent = await db.query(
    `SELECT id, rating, role, question, answer, comment, tools, at FROM assistant_feedback ORDER BY (rating = 'down') DESC, at DESC LIMIT 25`,
  );

  const dailyRows = daily.rows.map((row) => {
    const inputTokens = Number(row.input);
    const outputTokens = Number(row.output);
    return { day: String(row.day instanceof Date ? row.day.toISOString().slice(0, 10) : row.day).slice(0, 10), requests: Number(row.requests), inputTokens, outputTokens, estimatedCostUsd: estimateCost(inputTokens, outputTokens, rates) };
  });
  const totals = dailyRows.reduce(
    (sum, row) => ({ requests: sum.requests + row.requests, inputTokens: sum.inputTokens + row.inputTokens, outputTokens: sum.outputTokens + row.outputTokens, estimatedCostUsd: 0 }),
    { requests: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
  );
  totals.estimatedCostUsd = estimateCost(totals.inputTokens, totals.outputTokens, rates);
  const count = (rating: string) => Number(counts.rows.find((row) => row.rating === rating)?.n ?? 0);

  return {
    days,
    totals,
    daily: dailyRows,
    byRole: byRole.rows.map((row) => ({ role: String(row.role), requests: Number(row.requests), tokens: Number(row.input) + Number(row.output), estimatedCostUsd: estimateCost(Number(row.input), Number(row.output), rates) })),
    topUsers: users.rows.map((row) => ({ userId: String(row.user_id), role: String(row.role ?? 'unknown'), requests: Number(row.requests), tokens: Number(row.tokens) })),
    feedback: {
      up: count('up'),
      down: count('down'),
      recent: recent.rows.map((row) => ({ id: Number(row.id), rating: String(row.rating), role: (row.role as string | null) ?? null, question: String(row.question ?? ''), answer: String(row.answer ?? ''), comment: (row.comment as string | null) ?? null, tools: (row.tools as string[]) ?? [], at: new Date(row.at as string).toISOString() })),
    },
  };
}
