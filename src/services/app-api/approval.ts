import type {
  ApprovalEbayBodyPreviewInput,
  ApprovalEbayCategoryPreviewInput,
  ApprovalNormalizeResult,
  ApprovalNormalizeTarget,
  ApprovalPublishExecutionResult,
  ApprovalPublishTarget,
  ApprovalTakeDownExecutionResult,
  ApprovalTakeDownTarget,
  AirtableConfiguredRecordsSource,
} from '@contracts/approval';
import { isAppApiHttpError } from './errors';
import { postJson } from './http';

const APPROVAL_TAKEDOWN_REQUEST_TIMEOUT_MS = 45000;

export type {
  ApprovalEbayBodyPreviewInput,
  ApprovalEbayCategoryPreviewInput,
  ApprovalNormalizeResult,
  ApprovalNormalizeTarget,
  ApprovalPublishExecutionResult,
  ApprovalPublishTarget,
  ApprovalTakeDownExecutionResult,
  ApprovalTakeDownTarget,
};

function toApprovalError(error: unknown): Error {
  if (isAppApiHttpError(error)) {
    return new Error(error.message);
  }

  return error instanceof Error ? error : new Error(String(error));
}

export async function normalizeApprovalRecord(
  fields: Record<string, unknown>,
  target: ApprovalNormalizeTarget,
  options: {
    bodyPreview?: ApprovalEbayBodyPreviewInput;
    categoryPreview?: ApprovalEbayCategoryPreviewInput;
  } = {},
): Promise<ApprovalNormalizeResult> {
  try {
    return await postJson<ApprovalNormalizeResult>('/api/approval/normalize', {
      target,
      fields,
      bodyPreview: options.bodyPreview,
      categoryPreview: options.categoryPreview,
    });
  } catch (error) {
    throw toApprovalError(error);
  }
}

export async function publishApprovalRecord(
  source: AirtableConfiguredRecordsSource,
  recordId: string,
  target: ApprovalPublishTarget,
  options: {
    productIdFieldName?: string;
    fields?: Record<string, unknown>;
  } = {},
): Promise<ApprovalPublishExecutionResult> {
  try {
    return await postJson<ApprovalPublishExecutionResult>('/api/approval/publish', {
      target,
      source,
      recordId,
      productIdFieldName: options.productIdFieldName,
      fields: options.fields,
    });
  } catch (error) {
    throw toApprovalError(error);
  }
}

export async function takeDownApprovalRecord(
  recordId: string,
  target: ApprovalTakeDownTarget,
): Promise<ApprovalTakeDownExecutionResult> {
  try {
    return await postJson<ApprovalTakeDownExecutionResult>('/api/approval/takedown', {
      target,
      recordId,
    }, {
      timeoutMs: APPROVAL_TAKEDOWN_REQUEST_TIMEOUT_MS,
    });
  } catch (error) {
    throw toApprovalError(error);
  }
}