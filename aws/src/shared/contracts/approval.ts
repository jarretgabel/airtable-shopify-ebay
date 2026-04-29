import type { EbayApprovalPreviewResult, EbayApprovalPushResult, EbayPublishSetup } from './ebayApproval.js';
import type { ShopifyApprovalPreviewResult, ShopifyApprovalPublishResult } from './shopifyApproval.js';

export type AirtableConfiguredRecordsSource =
  | 'users'
  | 'inventory-directory'
  | 'approval-ebay'
  | 'approval-shopify'
  | 'approval-combined';

export type ApprovalPublishTarget = 'shopify' | 'ebay' | 'both';
export type ApprovalNormalizeTarget = ApprovalPublishTarget;

export interface ApprovalEbayBodyPreviewInput {
  templateHtml: string;
  title: string;
  description: string;
  keyFeatures: string;
  testingNotes?: string;
  fieldName?: string;
}

export interface ApprovalEbayCategoryPreviewInput {
  labelsById?: Record<string, string>;
}

export interface ApprovalNormalizeRequestBody {
  target?: ApprovalNormalizeTarget;
  fields?: Record<string, unknown>;
  bodyPreview?: ApprovalEbayBodyPreviewInput;
  categoryPreview?: ApprovalEbayCategoryPreviewInput;
}

export interface ApprovalNormalizeRequest {
  target: ApprovalNormalizeTarget;
  fields: Record<string, unknown>;
  bodyPreview?: ApprovalEbayBodyPreviewInput;
  categoryPreview?: ApprovalEbayCategoryPreviewInput;
}

export interface ApprovalNormalizeResult {
  target: ApprovalNormalizeTarget;
  shopify?: ShopifyApprovalPreviewResult;
  ebay?: EbayApprovalPreviewResult;
}

export interface ApprovalPublishRequestBody {
  target?: ApprovalPublishTarget;
  source?: AirtableConfiguredRecordsSource;
  recordId?: string;
  productIdFieldName?: string;
  publishSetup?: EbayPublishSetup;
  fields?: Record<string, unknown>;
}

export interface ApprovalPublishRequest {
  target: ApprovalPublishTarget;
  source: AirtableConfiguredRecordsSource;
  recordId: string;
  productIdFieldName?: string;
  publishSetup?: EbayPublishSetup;
  fields?: Record<string, unknown>;
}

export interface ApprovalPublishFailure {
  target: 'shopify' | 'ebay';
  message: string;
}

export interface ApprovalPublishEbayExecutionResult extends EbayApprovalPushResult {
  mode: 'created' | 'updated';
}

export interface ApprovalPublishExecutionResult {
  target: ApprovalPublishTarget;
  shopify?: ShopifyApprovalPublishResult;
  ebay?: ApprovalPublishEbayExecutionResult;
  failures: ApprovalPublishFailure[];
}

export interface ContractValidationFailure {
  ok: false;
  message: string;
}

export interface ContractValidationSuccess<TValue> {
  ok: true;
  value: TValue;
}

export type ContractValidationResult<TValue> = ContractValidationFailure | ContractValidationSuccess<TValue>;

const CONFIGURED_RECORD_SOURCES = new Set<AirtableConfiguredRecordsSource>([
  'users',
  'inventory-directory',
  'approval-ebay',
  'approval-shopify',
  'approval-combined',
]);

function success<TValue>(value: TValue): ContractValidationSuccess<TValue> {
  return { ok: true, value };
}

function failure(message: string): ContractValidationFailure {
  return { ok: false, message };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isPlainObject(value) && Object.values(value).every((entry) => typeof entry === 'string');
}

export function isApprovalTarget(value: unknown): value is ApprovalPublishTarget {
  return value === 'shopify' || value === 'ebay' || value === 'both';
}

export function validateApprovalEbayBodyPreviewInput(value: unknown): ContractValidationResult<ApprovalEbayBodyPreviewInput | undefined> {
  if (value === undefined) {
    return success(undefined);
  }

  if (!isPlainObject(value)) {
    return failure('bodyPreview must be an object when provided');
  }

  if (!isNonEmptyString(value.templateHtml) || !isOptionalString(value.testingNotes) || !isOptionalString(value.fieldName)) {
    return failure('bodyPreview is invalid');
  }

  if (!isOptionalString(value.title) || !isOptionalString(value.description) || !isOptionalString(value.keyFeatures)) {
    return failure('bodyPreview is invalid');
  }

  return success({
    templateHtml: value.templateHtml,
    title: typeof value.title === 'string' ? value.title : '',
    description: typeof value.description === 'string' ? value.description : '',
    keyFeatures: typeof value.keyFeatures === 'string' ? value.keyFeatures : '',
    ...(typeof value.testingNotes === 'string' ? { testingNotes: value.testingNotes } : {}),
    ...(typeof value.fieldName === 'string' ? { fieldName: value.fieldName } : {}),
  });
}

export function validateApprovalEbayCategoryPreviewInput(value: unknown): ContractValidationResult<ApprovalEbayCategoryPreviewInput | undefined> {
  if (value === undefined) {
    return success(undefined);
  }

  if (!isPlainObject(value)) {
    return failure('categoryPreview must be an object when provided');
  }

  if (value.labelsById !== undefined && !isStringRecord(value.labelsById)) {
    return failure('categoryPreview.labelsById must be a string map');
  }

  return success({ labelsById: value.labelsById });
}

function validateEbayPublishSetup(value: unknown): ContractValidationResult<EbayPublishSetup | undefined> {
  if (value === undefined) {
    return success(undefined);
  }

  if (!isPlainObject(value) || !isPlainObject(value.locationConfig) || !isPlainObject(value.policyConfig)) {
    return failure('publishSetup is invalid');
  }

  const { locationConfig, policyConfig } = value;
  if (
    !isNonEmptyString(locationConfig.key)
    || !isNonEmptyString(locationConfig.name)
    || !isNonEmptyString(locationConfig.country)
    || !isNonEmptyString(locationConfig.postalCode)
    || !isNonEmptyString(locationConfig.city)
    || !isNonEmptyString(locationConfig.stateOrProvince)
    || !isNonEmptyString(policyConfig.fulfillmentPolicyId)
    || !isNonEmptyString(policyConfig.paymentPolicyId)
    || !isNonEmptyString(policyConfig.returnPolicyId)
  ) {
    return failure('publishSetup is invalid');
  }

  return success({
    locationConfig: {
      key: locationConfig.key,
      name: locationConfig.name,
      country: locationConfig.country,
      postalCode: locationConfig.postalCode,
      city: locationConfig.city,
      stateOrProvince: locationConfig.stateOrProvince,
    },
    policyConfig: {
      fulfillmentPolicyId: policyConfig.fulfillmentPolicyId,
      paymentPolicyId: policyConfig.paymentPolicyId,
      returnPolicyId: policyConfig.returnPolicyId,
    },
  });
}

export function validateApprovalNormalizeRequestBody(body: ApprovalNormalizeRequestBody): ContractValidationResult<ApprovalNormalizeRequest> {
  if (!isApprovalTarget(body.target) || !isPlainObject(body.fields)) {
    return failure('target and fields are required');
  }

  const bodyPreviewResult = validateApprovalEbayBodyPreviewInput(body.bodyPreview);
  if (!bodyPreviewResult.ok) {
    return bodyPreviewResult;
  }

  const categoryPreviewResult = validateApprovalEbayCategoryPreviewInput(body.categoryPreview);
  if (!categoryPreviewResult.ok) {
    return categoryPreviewResult;
  }

  return success({
    target: body.target,
    fields: body.fields,
    ...(bodyPreviewResult.value ? { bodyPreview: bodyPreviewResult.value } : {}),
    ...(categoryPreviewResult.value ? { categoryPreview: categoryPreviewResult.value } : {}),
  });
}

export function validateApprovalPublishRequestBody(body: ApprovalPublishRequestBody): ContractValidationResult<ApprovalPublishRequest> {
  if (!isApprovalTarget(body.target) || !isNonEmptyString(body.source) || !CONFIGURED_RECORD_SOURCES.has(body.source as AirtableConfiguredRecordsSource) || !isNonEmptyString(body.recordId)) {
    return failure('target, source, and recordId are required');
  }

  if (body.productIdFieldName !== undefined && !isNonEmptyString(body.productIdFieldName)) {
    return failure('productIdFieldName must be a non-empty string when provided');
  }

  if (body.fields !== undefined && !isPlainObject(body.fields)) {
    return failure('fields must be an object when provided');
  }

  const publishSetupResult = validateEbayPublishSetup(body.publishSetup);
  if (!publishSetupResult.ok) {
    return publishSetupResult;
  }

  return success({
    target: body.target,
    source: body.source as AirtableConfiguredRecordsSource,
    recordId: body.recordId,
    ...(body.productIdFieldName ? { productIdFieldName: body.productIdFieldName } : {}),
    ...(body.fields ? { fields: body.fields } : {}),
    ...(publishSetupResult.value ? { publishSetup: publishSetupResult.value } : {}),
  });
}