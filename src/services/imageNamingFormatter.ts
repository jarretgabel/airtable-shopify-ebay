import type { WorkflowImageRole } from '@/services/workflowImageMetadata';
import { buildSopFallbackFilename, ensureMinWords, IMAGE_NAMING_RULES, splitImageNameTokens } from '@shared/imageNamingRules';

const OPTIONAL_DESCRIPTOR_SET = new Set(['mint', 'serviced', 'restored', 'pair', 'black', 'walnut', 'rare', 'limited']);

export interface ImageNamingContext {
  brand: string;
  model: string;
  productType: string;
  companyName?: string;
}

export interface ImageNamingOptions {
  role?: WorkflowImageRole;
  customRole?: string;
  manualName?: string;
  optionalDescriptor?: string;
}

export interface ImageNamingResult {
  filename: string;
  warnings: string[];
}

const ROLE_LABELS: Record<Exclude<WorkflowImageRole, 'custom'>, string> = {
  front: 'Front View',
  rear: 'Rear View',
  'serial-plate': 'Serial Plate',
  'cosmetic-detail': 'Cosmetic Detail',
  connections: 'Connections',
  top: 'Top View',
  bottom: 'Bottom View',
  side: 'Side View',
  interior: 'Interior',
  accessories: 'Accessories',
  packaging: 'Packaging',
};

const ROLE_FILENAME_DETAIL_TOKENS: Record<Exclude<WorkflowImageRole, 'custom'>, string[]> = {
  front: ['front', 'view'],
  rear: ['rear', 'panel'],
  'serial-plate': ['serial', 'number'],
  'cosmetic-detail': ['cosmetic', 'detail'],
  connections: ['rear', 'connections'],
  top: ['top', 'view'],
  bottom: ['bottom', 'view'],
  side: ['side', 'angle'],
  interior: ['interior', 'detail'],
  accessories: ['included', 'accessory'],
  packaging: ['original', 'packaging'],
};

function splitIntoTokens(value: string): string[] {
  return splitImageNameTokens(value);
}

function ensureMinWordCount(tokens: string[], min = 5): string[] {
  return ensureMinWords(tokens, min);
}

function buildRoleDetailTokens(role: WorkflowImageRole | undefined, customRole: string | undefined): string[] {
  if (!role) {
    return ['hero', 'image'];
  }

  if (role === 'custom') {
    const customTokens = splitIntoTokens(customRole ?? '').filter((token) => !IMAGE_NAMING_RULES.numberOnlyPattern.test(token));
    if (customTokens.length >= 2) {
      return customTokens.slice(0, 3);
    }

    if (customTokens.length === 1) {
      return [customTokens[0], 'detail'];
    }

    return ['custom', 'detail'];
  }

  return ROLE_FILENAME_DETAIL_TOKENS[role];
}

function normalizeOptionalDescriptor(value: string | undefined): string | undefined {
  const normalized = splitIntoTokens(value ?? '').join('-').replace(/-/g, '');
  if (!normalized) return undefined;
  return OPTIONAL_DESCRIPTOR_SET.has(normalized) ? normalized : undefined;
}

function clampFilenameTokens(
  leadingTokens: string[],
  detailTokens: string[],
): { tokens: string[]; warnings: string[] } {
  const warnings: string[] = [];
  const cleanLeading = leadingTokens.filter((token) => !IMAGE_NAMING_RULES.numberOnlyPattern.test(token));
  const cleanDetail = detailTokens.filter((token) => !IMAGE_NAMING_RULES.numberOnlyPattern.test(token));

  const safeDetail = cleanDetail.length > 0 ? cleanDetail : ['image', 'detail'];
  const maxWords = IMAGE_NAMING_RULES.maxWords;
  const maxLeadingWords = Math.max(1, maxWords - safeDetail.length);
  const trimmedLeading = cleanLeading.slice(0, maxLeadingWords);

  if (trimmedLeading.length !== cleanLeading.length) {
    warnings.push('Filename trimmed to 10 words max.');
  }

  let nextTokens = [...trimmedLeading, ...safeDetail].slice(0, maxWords);
  nextTokens = ensureMinWordCount(nextTokens, 5);

  if (nextTokens.length !== cleanLeading.length + safeDetail.length) {
    warnings.push('Filename auto-adjusted to comply with naming rules.');
  }

  return { tokens: nextTokens, warnings };
}

function toTitle(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((token) => token ? `${token.slice(0, 1).toUpperCase()}${token.slice(1)}` : '')
    .join(' ')
    .trim();
}

function resolveRoleLabel(role: WorkflowImageRole | undefined, customRole: string | undefined): string {
  if (!role) return '';
  if (role === 'custom') {
    return toTitle(customRole ?? '');
  }

  return ROLE_LABELS[role];
}

export function buildImageFilename(context: ImageNamingContext, options: ImageNamingOptions = {}): ImageNamingResult {
  const warnings: string[] = [];
  const brandTokens = splitIntoTokens(context.brand);
  const modelTokens = splitIntoTokens(context.model);
  const productTypeTokens = splitIntoTokens(context.productType);
  const detailTokens = buildRoleDetailTokens(options.role, options.customRole);

  const leadingTokens = [...brandTokens, ...modelTokens, ...productTypeTokens];
  const { tokens: baseTokens, warnings: clampWarnings } = clampFilenameTokens(leadingTokens, detailTokens);

  if (options.manualName && options.manualName.trim().length > 0) {
    warnings.push('Manual filename entry is normalized to workflow naming rules.');
  }

  const optionalDescriptor = normalizeOptionalDescriptor(options.optionalDescriptor);
  let tokens = [...baseTokens];
  if (optionalDescriptor && !tokens.includes(optionalDescriptor)) {
    if (tokens.length >= 10) {
      tokens = [...tokens.slice(0, 9), optionalDescriptor];
    } else {
      tokens.push(optionalDescriptor);
    }
  }

  warnings.push(...clampWarnings);

  return {
    filename: `${tokens.join('-')}.jpg`,
    warnings,
  };
}

export function buildFallbackImageFilename(inputName: string): string {
  return buildSopFallbackFilename(inputName);
}

export function buildImageAltText(context: ImageNamingContext, options: ImageNamingOptions = {}): string {
  const brand = toTitle(context.brand);
  const model = context.model.trim();
  const productType = toTitle(context.productType);
  const roleLabel = resolveRoleLabel(options.role, options.customRole);
  return [brand, model, productType, roleLabel].filter(Boolean).join(' ').trim();
}

export function isImageRoleComplete(role: WorkflowImageRole | undefined, customRole: string | undefined): boolean {
  if (!role) return false;
  if (role !== 'custom') return true;
  return Boolean(customRole && customRole.trim().length > 0);
}
