export interface UsedGearWorkflowViewPreset {
  id: string;
  name: string;
  search: string;
  hash: string;
  savedAt: string;
}

const WORKFLOW_VIEW_PRESETS_STORAGE_KEY = 'used-gear-workflow-view-presets';

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isWorkflowViewPreset(value: unknown): value is UsedGearWorkflowViewPreset {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.search === 'string'
    && typeof candidate.hash === 'string'
    && typeof candidate.savedAt === 'string';
}

function writePresets(presets: UsedGearWorkflowViewPreset[]) {
  const storage = getStorage();
  if (!storage) {
    return presets;
  }

  storage.setItem(WORKFLOW_VIEW_PRESETS_STORAGE_KEY, JSON.stringify(presets));
  return presets;
}

export function loadUsedGearWorkflowViewPresets(): UsedGearWorkflowViewPreset[] {
  const storage = getStorage();
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(WORKFLOW_VIEW_PRESETS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isWorkflowViewPreset)
      .sort((left, right) => right.savedAt.localeCompare(left.savedAt));
  } catch {
    return [];
  }
}

export function saveUsedGearWorkflowViewPreset(input: Pick<UsedGearWorkflowViewPreset, 'name' | 'search' | 'hash'>): UsedGearWorkflowViewPreset[] {
  const name = input.name.trim();
  if (!name) {
    return loadUsedGearWorkflowViewPresets();
  }

  const savedAt = new Date().toISOString();
  const current = loadUsedGearWorkflowViewPresets();
  const existing = current.find((preset) => preset.name.toLowerCase() === name.toLowerCase());
  const nextPreset: UsedGearWorkflowViewPreset = {
    id: existing?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    search: input.search,
    hash: input.hash,
    savedAt,
  };

  const nextPresets = [nextPreset, ...current.filter((preset) => preset.id !== nextPreset.id)]
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt));

  return writePresets(nextPresets);
}

export function deleteUsedGearWorkflowViewPreset(presetId: string): UsedGearWorkflowViewPreset[] {
  return writePresets(loadUsedGearWorkflowViewPresets().filter((preset) => preset.id !== presetId));
}