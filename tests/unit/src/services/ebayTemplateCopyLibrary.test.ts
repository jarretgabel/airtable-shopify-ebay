import {
  deleteEbayTemplateCopy,
  EBAY_TEMPLATE_COPY_LIBRARY_STORAGE_KEY,
  loadEbayTemplateCopyLibrary,
  saveEbayTemplateCopy,
} from '@/services/ebayTemplateCopyLibrary';

describe('eBay template copy library', () => {
  beforeEach(() => window.localStorage.clear());

  it('saves named templates and updates an existing name without duplicating it', () => {
    const first = saveEbayTemplateCopy('As Is', '<p>First copy</p>');
    const second = saveEbayTemplateCopy('as is', '<p>Updated copy</p>');

    expect(first).toHaveLength(1);
    expect(second).toEqual([expect.objectContaining({
      id: first[0]?.id,
      name: 'as is',
      html: '<p>Updated copy</p>',
    })]);
    expect(loadEbayTemplateCopyLibrary()).toEqual(second);
  });

  it('ignores malformed storage entries and deletes templates by id', () => {
    window.localStorage.setItem(EBAY_TEMPLATE_COPY_LIBRARY_STORAGE_KEY, JSON.stringify([
      { id: 'valid', name: 'Valid', html: '<p>Copy</p>', updatedAt: '2026-09-27T00:00:00.000Z' },
      { id: '', name: 'Invalid', html: '' },
    ]));

    expect(loadEbayTemplateCopyLibrary()).toHaveLength(1);
    expect(deleteEbayTemplateCopy('valid')).toEqual([]);
  });
});