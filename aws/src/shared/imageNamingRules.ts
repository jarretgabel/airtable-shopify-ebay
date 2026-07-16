export const IMAGE_NAMING_RULES = {
  minWords: 5,
  maxWords: 10,
  defaultFillerTokens: ['product', 'image', 'detail'],
  cameraTokenPattern: /^(img|dsc|pxl|pixel|canon|nikon|sony|iphone|gopro)\d*$/i,
  versionTokenPattern: /^v\d+$/i,
  numberOnlyPattern: /^\d+$/,
  companyTokenPattern: /^resolutionav$/i,
} as const;

export interface ImageTokenizeOptions {
  stripCompanyTokens?: boolean;
  stripVersionTokens?: boolean;
  stripNumberOnlyTokens?: boolean;
}

export function splitImageNameTokens(value: string, options: ImageTokenizeOptions = {}): string[] {
  const {
    stripCompanyTokens = true,
    stripVersionTokens = true,
    stripNumberOnlyTokens = true,
  } = options;

  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !IMAGE_NAMING_RULES.cameraTokenPattern.test(token))
    .filter((token) => !(stripVersionTokens && IMAGE_NAMING_RULES.versionTokenPattern.test(token)))
    .filter((token) => !(stripNumberOnlyTokens && IMAGE_NAMING_RULES.numberOnlyPattern.test(token)))
    .filter((token) => !(stripCompanyTokens && IMAGE_NAMING_RULES.companyTokenPattern.test(token)));
}

export function ensureMinWords(tokens: string[], minWords: number = IMAGE_NAMING_RULES.minWords): string[] {
  const nextTokens = [...tokens];
  let fillerIndex = 0;

  while (nextTokens.length < minWords) {
    nextTokens.push(IMAGE_NAMING_RULES.defaultFillerTokens[fillerIndex % IMAGE_NAMING_RULES.defaultFillerTokens.length]);
    fillerIndex += 1;
  }

  return nextTokens;
}

export function buildSopFallbackFilename(inputName: string): string {
  const stem = inputName.trim().replace(/\.[^.]+$/, '');
  const sourceTokens = splitImageNameTokens(stem);

  const primaryTokens = sourceTokens.length > 0
    ? sourceTokens.slice(0, 3)
    : ['brand', 'model', 'product'];

  const leadingTokens = [
    primaryTokens[0] ?? 'brand',
    primaryTokens[1] ?? 'model',
    primaryTokens[2] ?? 'product',
  ];

  const detailTokens = sourceTokens.slice(3, 5);
  const safeDetail = detailTokens.length > 0 ? detailTokens : ['hero', 'image'];
  const maxLeadingWords = Math.max(1, IMAGE_NAMING_RULES.maxWords - safeDetail.length);
  const trimmedLeading = leadingTokens.slice(0, maxLeadingWords);
  const normalizedTokens = ensureMinWords([
    ...trimmedLeading,
    ...safeDetail,
  ].slice(0, IMAGE_NAMING_RULES.maxWords));

  return `${normalizedTokens.join('-')}.jpg`;
}