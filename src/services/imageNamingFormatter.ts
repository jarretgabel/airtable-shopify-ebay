import type { WorkflowImageRole } from '@/services/workflowImageMetadata';

const CAMERA_TOKEN_PATTERN = /^(img|dsc|pxl|pixel|canon|nikon|sony|iphone|gopro|v\d+)\d*$/;
const NUMBER_ONLY_PATTERN = /^\d+$/;

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
}

export interface ImageNamingResult {
  filename: string;
  warnings: string[];
}

function splitIntoTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !CAMERA_TOKEN_PATTERN.test(token));
}

function formatRoleToken(role: WorkflowImageRole | undefined, customRole: string | undefined): string[] {
  if (!role) return ['image'];
  if (role === 'custom') {
    const customTokens = splitIntoTokens(customRole ?? '').filter((token) => !NUMBER_ONLY_PATTERN.test(token));
    return customTokens.length > 0 ? customTokens : ['image'];
  }

  return splitIntoTokens(role);
}

function toTitle(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((token) => token ? `${token.slice(0, 1).toUpperCase()}${token.slice(1)}` : '')
    .join(' ')
    .trim();
}

function clampTokens(tokens: string[]): { tokens: string[]; warnings: string[] } {
  const warnings: string[] = [];
  const filtered = tokens.filter((token) => !NUMBER_ONLY_PATTERN.test(token));

  if (filtered.length > 10) {
    warnings.push('Filename trimmed to 10 words max.');
  }

  const next = filtered.slice(0, 10);
  while (next.length < 5) {
    next.push('image');
  }

  if (next.length !== filtered.length) {
    warnings.push('Filename auto-adjusted to comply with naming rules.');
  }

  return { tokens: next, warnings };
}

export function buildImageFilename(context: ImageNamingContext, options: ImageNamingOptions = {}): ImageNamingResult {
  const warnings: string[] = [];
  const baseTokens = [
    ...splitIntoTokens(context.brand),
    ...splitIntoTokens(context.model),
    ...splitIntoTokens(context.productType),
    ...formatRoleToken(options.role, options.customRole),
  ];

  if (options.manualName && options.manualName.trim().length > 0) {
    warnings.push('Manual filename entry is normalized to workflow naming rules.');
  }

  const { tokens, warnings: clampWarnings } = clampTokens(baseTokens);
  warnings.push(...clampWarnings);

  return {
    filename: `${tokens.join('-')}.jpg`,
    warnings,
  };
}

export function buildImageAltText(context: ImageNamingContext): string {
  const brand = toTitle(context.brand);
  const model = context.model.trim();
  const productType = context.productType.trim().toLowerCase();
  const prefix = [brand, model, productType].filter(Boolean).join(' ').trim();
  const company = context.companyName?.trim();

  if (!company) {
    return prefix;
  }

  return `${prefix} available at ${company}`.trim();
}

export function isImageRoleComplete(role: WorkflowImageRole | undefined, customRole: string | undefined): boolean {
  if (!role) return false;
  if (role !== 'custom') return true;
  return Boolean(customRole && customRole.trim().length > 0);
}
