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

    expect(first).toHaveLength(2);
    expect(second).toEqual([expect.objectContaining({
      id: first[0]?.id,
      name: 'as is',
      html: '<p>Updated copy</p>',
    }), expect.objectContaining({
      id: 'template-ebay-copy-default',
      name: 'eBay Template Copy',
    })]);
    expect(loadEbayTemplateCopyLibrary()).toEqual(second);
  });

  it('provides the previous eBay Template Copy value as the first saved template', () => {
    expect(loadEbayTemplateCopyLibrary()).toEqual([expect.objectContaining({
      id: 'template-ebay-copy-default',
      name: 'eBay Template Copy',
      html: '<p>All included items are pictured.</p><p>Each unit is tested; defects or service notes are listed below. 30-day warranty included.</p><p>Local pickup in NYC available.</p>',
    })]);
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