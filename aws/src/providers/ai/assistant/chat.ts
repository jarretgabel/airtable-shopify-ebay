import { logError, logInfo } from '../../../shared/logging.js';
import { HttpError } from '../../../shared/errors.js';
import { getOptionalSecret } from '../../../shared/secrets.js';
import type { AssistantDraft } from '../../../shared/contracts/intakeDraft.js';
import { canDraftAnyStage, canDraftIntake, getAssistantToolDefinitions, runAssistantTool, type AssistantToolContext } from './tools.js';
import { listAccessiblePageLinks, type AssistantScope } from './scope.js';

const DEFAULT_MODEL = 'claude-sonnet-4-5';
const MAX_TOOL_ROUNDS = 6;
const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 4000;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

interface ApiMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

function buildSystemPrompt(scope: AssistantScope, currentPath?: string, draft?: AssistantDraft): string {
  const visibility = scope.statuses === null
    ? 'all workflow stages'
    : scope.statuses.length > 0 ? `only items in: ${scope.statuses.join(', ')}` : 'no inventory items';
  return `You are the in-app assistant for Resolution AV's used hi-fi inventory and listing tool.
Answer questions about inventory items and listings (an item that is also a listing has listingStatus and listingLink; report both statuses and link both pages), intake and workflow status, and product details using the provided tools. Never guess item data: call a tool, and say so when nothing is found. Call a tool again for every lookup question, even if an earlier message in this conversation said an item was not found: earlier answers may be stale or wrong, and you must never claim to have searched unless you called a tool in this turn. When searching by SKU, pass only the number as the query.
For how-to, process, role, stage or page questions, call search_docs and answer only from what it returns; if it has nothing relevant, say you don't know rather than inventing process details.
The current user can see ${visibility}. Never reveal or speculate about data outside that scope; if asked, say you can't access it.
Pages this user can open (link them in markdown when helpful): ${listAccessiblePageLinks(scope).map((page) => `${page.label} (${page.path})`).join(', ') || 'none'}.
${currentPath ? `The user is currently viewing ${currentPath}. If the path ends in a record id (rec...), "this item" or "this listing" means that record: look it up with get_item.` : ''}
${canDraftIntake(scope) ? `You can help create a new intake item. Gather details conversationally, never invent values, and call propose_intake_item with ALL known fields each time something is added or changed. Ask for any missing required fields. For invalid select values, offer the allowed options. A draft is only shown for review: tell the user to press "Create item" on the draft card, and never say the item was created.` : ''}
${canDraftAnyStage(scope) ? `You can also fill in the Testing or Photography form for an existing item: call propose_stage_update with the stage, the item's record id and ALL known fields, never inventing values. The user reviews the draft card and presses Save or Complete, and can drag images onto the chat to attach them (mention this when relevant); never say the form was saved or completed. For "this item" use the record id from the current page.` : ''}
${draft ? `Current ${draft.kind} draft${draft.recordId ? ` for ${draft.recordId}` : ''}: ${JSON.stringify(draft.values)}` : ''}
Approval checkboxes are no longer used: publishing is gated by the required listing fields being filled and the Publish button. Never describe an item as needing approval. For what is left before publishing, use the publishReadiness object on a listing result (shopifyMissingFields, ebayMissingFields, missingSku, state) and report exactly those; if publishReadiness is absent, say you can't tell and link the listing page.\nBe concise. Refer to items by make, model and SKU, and always link an item with markdown using its link value from the tool result, e.g. [McIntosh MC275](/testing/recXXXX). Only use links returned by tools; if an item has no link, don't invent one.`;
}

export function sanitizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const messages = raw
    .filter((m): m is ChatMessage => !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim() !== '')
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }))
    .slice(-MAX_MESSAGES);
  while (messages.length > 0 && messages[0].role !== 'user') messages.shift();
  return messages;
}

async function callAnthropic(system: string, messages: ApiMessage[], scope: AssistantScope) {
  const apiKey = getOptionalSecret('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new HttpError(500, 'Anthropic API key is not configured', { service: 'ai', code: 'AI_PROVIDER_NOT_CONFIGURED', retryable: false });
  }
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: getOptionalSecret('ANTHROPIC_MODEL') ?? DEFAULT_MODEL,
      max_tokens: 1200,
      temperature: 0.2,
      system,
      tools: getAssistantToolDefinitions(scope),
      messages,
    }),
  });
  if (!response.ok) {
    throw new HttpError(response.status === 429 ? 429 : 502, `Anthropic API error ${response.status}`, {
      service: 'ai',
      code: 'AI_PROVIDER_ERROR',
      retryable: response.status >= 500 || response.status === 429,
    });
  }
  return await response.json() as { stop_reason?: string; content?: ContentBlock[]; usage?: { input_tokens?: number; output_tokens?: number } };
}

export interface AssistantChatResult {
  reply: string;
  usage?: { inputTokens: number; outputTokens: number; rounds: number; tools: string[] };
  draft?: AssistantDraft;
}

export async function runAssistantChat(
  scope: AssistantScope,
  history: ChatMessage[],
  currentPath?: string,
  currentDraft?: AssistantDraft,
): Promise<AssistantChatResult> {
  const system = buildSystemPrompt(scope, currentPath, currentDraft);
  const context: AssistantToolContext = {};
  const messages: ApiMessage[] = history.map((m) => ({ role: m.role, content: m.content }));
  const usage = { inputTokens: 0, outputTokens: 0, rounds: 0, tools: [] as string[] };

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const reply = await callAnthropic(system, messages, scope);
    usage.rounds += 1;
    usage.inputTokens += reply.usage?.input_tokens ?? 0;
    usage.outputTokens += reply.usage?.output_tokens ?? 0;
    const blocks = reply.content ?? [];
    const toolUses = blocks.filter((b): b is Extract<ContentBlock, { type: 'tool_use' }> => b.type === 'tool_use');

    if (reply.stop_reason !== 'tool_use' || toolUses.length === 0) {
      const reply = blocks.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('').trim()
        || "I couldn't come up with an answer.";
      return { reply, draft: context.draft, usage };
    }

    messages.push({ role: 'assistant', content: blocks });
    const results: ContentBlock[] = [];
    for (const use of toolUses) {
      usage.tools.push(use.name);
      let content: string;
      try {
        content = JSON.stringify(await runAssistantTool(scope, use.name, use.input ?? {}, context));
      } catch (error) {
        logError(`Assistant tool ${use.name} failed`, error);
        content = JSON.stringify({ error: 'The lookup failed with a system error. Tell the user it failed; do not say the item does not exist.' });
      }
      logInfo('Assistant tool call', { tool: use.name, resultChars: content.length, failed: content.startsWith('{"error"') });
      results.push({ type: 'tool_result', tool_use_id: use.id, content: content.slice(0, 20000) });
    }
    messages.push({ role: 'user', content: results });
  }
  return { reply: 'That took too many steps. Please try a more specific question.', draft: context.draft, usage };
}
