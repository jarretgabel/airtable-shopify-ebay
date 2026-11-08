import { getJson } from './http';

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

export function getAssistantInsights(): Promise<AssistantInsights> {
  return getJson<AssistantInsights>('/api/assistant/insights');
}
