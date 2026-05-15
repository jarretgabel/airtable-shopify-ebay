import { describe, expect, it } from 'vitest';
import {
  applyUsedGearWorkflowNoteTemplate,
  getUsedGearWorkflowNoteTemplates,
} from '@/services/usedGearWorkflowNoteTemplates';

describe('usedGearWorkflowNoteTemplates', () => {
  it('returns shared templates for each supported workflow note group', () => {
    expect(getUsedGearWorkflowNoteTemplates('qualification')).toHaveLength(3);
    expect(getUsedGearWorkflowNoteTemplates('unqualified-reason')).toHaveLength(3);
    expect(getUsedGearWorkflowNoteTemplates('stale-recovery')).toHaveLength(3);
    expect(getUsedGearWorkflowNoteTemplates('shipment-follow-through')).toHaveLength(3);
  });

  it('uses the template directly when the note is empty', () => {
    expect(applyUsedGearWorkflowNoteTemplate('', 'Fresh template')).toBe('Fresh template');
  });

  it('appends a template on a new line when the note already has content', () => {
    expect(applyUsedGearWorkflowNoteTemplate('Existing note', 'Fresh template')).toBe('Existing note\nFresh template');
  });

  it('does not duplicate a template that is already present', () => {
    expect(applyUsedGearWorkflowNoteTemplate('Existing note\nFresh template', 'Fresh template')).toBe('Existing note\nFresh template');
  });
});