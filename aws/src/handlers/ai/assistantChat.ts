import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { enforceAssistantLimits, recordAssistantTokens } from '../../providers/ai/assistant/limits.js';
import { runAssistantChat, sanitizeMessages } from '../../providers/ai/assistant/chat.js';
import { buildDraft } from '../../providers/ai/assistant/intake.js';
import type { AssistantDraft, DraftKind } from '../../shared/contracts/intakeDraft.js';
import { canDraftIntake, canDraftStage } from '../../providers/ai/assistant/tools.js';
import { resolveAssistantScope, sanitizeCurrentPath } from '../../providers/ai/assistant/scope.js';

async function rebuildDraft(raw: unknown, scope: ReturnType<typeof resolveAssistantScope>): Promise<AssistantDraft | undefined> {
  if (!raw || typeof raw !== 'object') return undefined;
  const { kind, recordId, values } = raw as { kind?: unknown; recordId?: unknown; values?: unknown };
  const draftKind: DraftKind = kind === 'testing' || kind === 'photos' ? kind : 'intake';
  if (draftKind === 'intake' ? !canDraftIntake(scope) : !canDraftStage(scope, draftKind)) return undefined;
  const safeRecordId = typeof recordId === 'string' && /^rec[A-Za-z0-9]{10,}$/.test(recordId) ? recordId : undefined;
  if (draftKind !== 'intake' && !safeRecordId) return undefined;
  return { kind: draftKind, recordId: safeRecordId, ...await buildDraft(draftKind, values) };
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  const startedAt = Date.now();
  try {
    const user = await requireRouteAccess(event);
    enforceAssistantLimits(user.userId);
    const body = requireJsonBody<{ messages?: unknown; currentPath?: unknown; draft?: unknown }>(event, 'ai', 'INVALID_AI_REQUEST_BODY');
    const messages = sanitizeMessages(body.messages);
    if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
      return jsonError(400, { message: 'A user message is required', service: 'ai', code: 'MISSING_ASSISTANT_MESSAGE', retryable: false }, { origin });
    }
    const scope = resolveAssistantScope(user);
    const currentDraft = await rebuildDraft(body.draft, scope);
    const result = await runAssistantChat(scope, messages, sanitizeCurrentPath(body.currentPath), currentDraft);
    const { usage, ...response } = result;
    if (usage) {
      recordAssistantTokens(user.userId, usage.inputTokens + usage.outputTokens);
      // Metadata only: message content is never logged.
      logInfo('Assistant chat', { userId: user.userId, role: user.role, ...usage, draftKind: response.draft?.kind ?? null, durationMs: Date.now() - startedAt });
    }
    return jsonOk(response, { origin });
  } catch (error) {
    logError('Assistant chat failed', error);
    return jsonError(getStatusCode(error), toApiErrorBody('ai', error, 'AI_ASSISTANT_FAILED'), { origin });
  }
}
