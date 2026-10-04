export interface EbayTemplateCopyEntry {
  id: string;
  name: string;
  html: string;
  updatedAt: string;
}

export const EBAY_TEMPLATE_COPY_LIBRARY_STORAGE_KEY = 'ebay-template-copy-library:v1';

export const DEFAULT_EBAY_TEMPLATE_COPY_ENTRY: EbayTemplateCopyEntry = {
  id: 'template-ebay-copy-default',
  name: 'eBay Template Copy',
  html: '<p>All included items are pictured.</p><p>Each unit is tested; defects or service notes are listed below. 30-day warranty included.</p><p>Local pickup in NYC available.</p>',
  updatedAt: '2026-10-04T00:00:00.000Z',
};

function getStorage(): Storage | null {
  return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
}

function normalizeEntries(value: unknown): EbayTemplateCopyEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry) => ({
      id: typeof entry.id === 'string' ? entry.id.trim() : '',
      name: typeof entry.name === 'string' ? entry.name.trim() : '',
      html: typeof entry.html === 'string' ? entry.html : '',
      updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : '',
    }))
    .filter((entry) => entry.id && entry.name && entry.html.trim())
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function loadEbayTemplateCopyLibrary(): EbayTemplateCopyEntry[] {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const storedValue = storage.getItem(EBAY_TEMPLATE_COPY_LIBRARY_STORAGE_KEY);
    if (storedValue === null) return [DEFAULT_EBAY_TEMPLATE_COPY_ENTRY];
    return normalizeEntries(JSON.parse(storedValue));
  } catch {
    return [];
  }
}

export function saveEbayTemplateCopy(name: string, html: string): EbayTemplateCopyEntry[] {
  const normalizedName = name.trim();
  if (!normalizedName || !html.trim()) return loadEbayTemplateCopyLibrary();

  const current = loadEbayTemplateCopyLibrary();
  const existing = current.find((entry) => entry.name.toLowerCase() === normalizedName.toLowerCase());
  const nextEntry: EbayTemplateCopyEntry = {
    id: existing?.id ?? `template-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: normalizedName,
    html,
    updatedAt: new Date().toISOString(),
  };
  const next = [...current.filter((entry) => entry.id !== nextEntry.id), nextEntry]
    .sort((left, right) => left.name.localeCompare(right.name));
  getStorage()?.setItem(EBAY_TEMPLATE_COPY_LIBRARY_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function deleteEbayTemplateCopy(id: string): EbayTemplateCopyEntry[] {
  const next = loadEbayTemplateCopyLibrary().filter((entry) => entry.id !== id);
  getStorage()?.setItem(EBAY_TEMPLATE_COPY_LIBRARY_STORAGE_KEY, JSON.stringify(next));
  return next;
}