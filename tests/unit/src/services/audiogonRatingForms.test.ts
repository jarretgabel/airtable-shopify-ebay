import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getConfiguredFieldMetadata, getConfiguredRecord, updateConfiguredRecord } from '@/services/app-api/airtable';
import { loadTestingFormOptionSets, loadTestingFormValues, submitTestingForm } from '@/services/testingForm';
import { loadPhotosFormOptionSets, loadPhotosFormValues, submitPhotosForm } from '@/services/photosForm';
import { createTestingFormDefaults } from '@/components/tabs/testing/testingFormSchema';
import { createPhotosFormDefaults } from '@/components/tabs/photos/photosFormSchema';
import type { AirtableRecord } from '@/types/airtable';

vi.mock('@/services/app-api/airtable', () => ({
  getConfiguredFieldMetadata: vi.fn(), getConfiguredRecord: vi.fn(),
  updateConfiguredRecord: vi.fn(), uploadConfiguredAttachment: vi.fn(),
}));
vi.mock('@/services/currentUserAudit', () => ({ resolveCurrentActorName: () => 'Reviewer' }));

const labels = [
  '10/10: Mint - New in box, no visible imperfections.',
  '9/10: Excellent - Light use, no visible imperfections.',
  '8/10: Very Good - Flawless front face, other minor imperfections.',
  '7/10: Good - Light signs of wear, looks used but well-maintained.',
  '6/10: Fair - Pronounced signs of wear.',
  '5/10: Average - Noticeably used, imperfections on the front face.',
  '4/10: Mediocre - Looks worn out.',
  '3/10: Poor - Looks beat up.',
  '2/10: Very Poor - Looks beat up.',
  '1/10: Shot - For parts use only.',
];

const record = (rating: unknown): AirtableRecord => ({
  id: 'rec-rating', createdTime: '2026-10-14T00:00:00.000Z',
  fields: {
    SKU: '11750', Make: 'Bel Canto', Model: 'PRe1',
    'Workflow Status': 'Testing In Progress', 'Audiogon Rating': rating,
    'Workflow Image Metadata JSON': '[]',
  },
});
const stages = [
  {
    name: 'Testing', load: loadTestingFormValues, options: loadTestingFormOptionSets,
    save: (rating: string) => submitTestingForm(
      { ...createTestingFormDefaults(), sku: '11750', audiogonRating: rating },
      'rec-rating', { recordSource: 'used-gear-workflow' },
    ),
  },
  {
    name: 'Photography', load: loadPhotosFormValues, options: loadPhotosFormOptionSets,
    save: (rating: string) => submitPhotosForm(
      { ...createPhotosFormDefaults(), sku: '11750', audiogonRating: rating },
      'rec-rating', { recordSource: 'used-gear-workflow' },
    ),
  },
];

describe.each(stages)('$name Audiogon rating compatibility', (stage) => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateConfiguredRecord).mockResolvedValue(record(undefined));
  });

  it('offers exactly the ten standard grades using existing Airtable choice values', async () => {
    vi.mocked(getConfiguredFieldMetadata).mockResolvedValue([{
      id: 'fld-rating', name: 'Audiogon Rating', type: 'multipleSelects',
      options: { choices: [...labels, '8', '8/10', 'other minor imperfections.'].map((name) => ({ name })) },
    }]);
    const options = await stage.options();
    expect(options).toHaveProperty('Audiogon Rating', labels);
  });

  it('saves a new grade as one complete multi-select choice, including its comma', async () => {
    vi.mocked(getConfiguredRecord).mockResolvedValue(record(['7/10']));
    await stage.save(labels[2]);
    expect(updateConfiguredRecord).toHaveBeenCalledWith(
      'used-gear-workflow', 'rec-rating',
      expect.objectContaining({ 'Audiogon Rating': [labels[2]] }), { typecast: true },
    );
  });

  it.each([
    ['8/10'],
    ['8'],
    [labels[2]],
    ['8/10: Very Good - Flawless front face', 'other minor imperfections.'],
    ['Legacy custom condition'],
  ])('preserves an unchanged legacy rating without rewriting it: %j', async (...rating) => {
    vi.mocked(getConfiguredRecord).mockResolvedValue(record(rating));
    const loaded = await stage.load('rec-rating');
    await stage.save(loaded.values.audiogonRating);
    const fields = vi.mocked(updateConfiguredRecord).mock.calls[0][2];
    expect(fields).not.toHaveProperty('Audiogon Rating');
    expect(fields).not.toHaveProperty('Workflow Image Metadata JSON');
  });

  it('does not overwrite a newer server rating when an unchanged loaded baseline is provided', async () => {
    vi.mocked(getConfiguredRecord).mockResolvedValue(record([labels[0]]));
    const values = {
      ...createTestingFormDefaults(), ...createPhotosFormDefaults(),
      sku: '11750', audiogonRating: '8/10',
    };
    const submit = stage.name === 'Testing' ? submitTestingForm : submitPhotosForm;
    await submit(values, 'rec-rating', { recordSource: 'used-gear-workflow', originalAudiogonRating: '8/10' });
    expect(vi.mocked(updateConfiguredRecord).mock.calls[0][2]).not.toHaveProperty('Audiogon Rating');
  });
});
