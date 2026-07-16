import { buildSopFallbackFilename } from './imageNamingRules.js';

export function normalizeProductImageFilename(input: string): string {
  return buildSopFallbackFilename(input);
}
