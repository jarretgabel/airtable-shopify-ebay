import { getAudiogonRatingOptions } from '../../../shared/contracts/audiogonRating.js';
import { getConfiguredFieldMetadata } from '../../../store/index.js';
import { ALL_DRAFT_OPTION_FIELDS, DRAFT_FIELDS_BY_KIND, normalizeDraft, type DraftKind, type IntakeDraftResult, type IntakeOptionSets } from '../../../shared/contracts/intakeDraft.js';

const OPTION_CACHE_MS = 10 * 60 * 1000;
const ORIGINAL_BOX_SEED = 'Other (describe in notes)';
let cache: { expiresAt: number; sets: IntakeOptionSets } | undefined;

/** Same option source as the Manual Intake form, so drafts can only use values that already exist. */
export async function loadIntakeOptionSets(): Promise<IntakeOptionSets | null> {
  if (cache && cache.expiresAt > Date.now()) return cache.sets;
  try {
    const fields = await getConfiguredFieldMetadata('inventory-directory');
    const sets: IntakeOptionSets = {};
    for (const optionField of ALL_DRAFT_OPTION_FIELDS) {
      const choices = fields.find((field) => field.name === optionField)?.options?.choices ?? [];
      let names = choices.map((choice) => choice.name);
      if (optionField === 'Original Box' && !names.includes(ORIGINAL_BOX_SEED)) names.push(ORIGINAL_BOX_SEED);
      if (optionField === 'Audiogon Rating') names = getAudiogonRatingOptions(names);
      sets[optionField] = names;
    }
    cache = { expiresAt: Date.now() + OPTION_CACHE_MS, sets };
    return sets;
  } catch {
    return null;
  }
}

export async function buildDraft(kind: DraftKind, raw: unknown): Promise<IntakeDraftResult> {
  return normalizeDraft(DRAFT_FIELDS_BY_KIND[kind], raw, await loadIntakeOptionSets());
}

export function buildIntakeDraft(raw: unknown): Promise<IntakeDraftResult> {
  return buildDraft('intake', raw);
}
