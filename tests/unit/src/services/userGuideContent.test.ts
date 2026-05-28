import { describe, expect, it } from 'vitest';
import { buildWorkflowGuideContentFromRecords, buildUserGuideEditableRecords } from '@/services/userGuideContent';
import type { AirtableRecord } from '@/types/airtable';

function buildRecord(id: string, fields: Record<string, unknown>): AirtableRecord {
  return {
    id,
    createdTime: '2026-05-27T00:00:00.000Z',
    fields,
  };
}

describe('userGuideContent', () => {
  it('maps seeded Airtable rows into workflow guide content', () => {
    const content = buildWorkflowGuideContentFromRecords([
      buildRecord('rec-role-processor', {
        'Content Key': 'role-guide.processor',
        'Content Type': 'role-guide',
        'Role Summary': 'Processor Airtable summary.',
        'Quick Start Title': 'Processor quick start from Airtable',
        'Quick Start Summary': 'Processor Airtable quick start summary.',
        'Quick Start Item 1': 'First Airtable item',
        'Flow Summary': 'Processor flow summary from Airtable.',
        'Flow Step 1 Title': 'Airtable first step',
        'Flow Step 1 Detail': 'Airtable first step detail',
        'Question 1': 'Airtable processor question?',
        'Answer 1': 'Airtable processor answer.',
      }),
      buildRecord('rec-page-dashboard', {
        'Content Key': 'page-guide.01',
        'Content Type': 'page-guide',
        Name: 'Page - Dashboard Airtable',
        Summary: 'Dashboard summary from Airtable.',
        'Module 1': 'Airtable module 1',
        'Workflow Use 1': 'Airtable workflow use 1',
        'Page 1': 'dashboard',
      }),
    ]);

    expect(content.roleGuides.processor.roleSummary).toBe('Processor Airtable summary.');
    expect(content.roleGuides.processor.quickStartTitle).toBe('Processor quick start from Airtable');
    expect(content.roleGuides.processor.flowSteps[0].title).toBe('Airtable first step');
    expect(content.roleGuides.processor.questions[0].question).toBe('Airtable processor question?');
    expect(content.pageCards[0].title).toBe('Dashboard Airtable');
    expect(content.pageCards[0].summary).toBe('Dashboard summary from Airtable.');
    expect(content.pageCards[0].modules[0]).toBe('Airtable module 1');
  });

  it('builds editable records with sort order and editable fields', () => {
    const records = buildUserGuideEditableRecords([
      buildRecord('rec-page-dashboard', {
        Name: 'Page - Dashboard Airtable',
        'Content Key': 'page-guide.01',
        'Content Type': 'page-guide',
        'Sort Order': 120,
        Summary: 'Dashboard summary from Airtable.',
        'Module 1': 'Airtable module 1',
      }),
    ]);

    expect(records).toEqual([
      expect.objectContaining({
        id: 'rec-page-dashboard',
        contentKey: 'page-guide.01',
        contentType: 'page-guide',
        sortOrder: 120,
        fieldValues: expect.objectContaining({
          Name: 'Page - Dashboard Airtable',
          Summary: 'Dashboard summary from Airtable.',
          'Module 1': 'Airtable module 1',
        }),
      }),
    ]);
  });
});