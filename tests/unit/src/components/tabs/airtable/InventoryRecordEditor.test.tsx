const { ebayCategoriesSelectSpy } = vi.hoisted(() => ({
  ebayCategoriesSelectSpy: vi.fn(),
}));

vi.mock('@/components/approval/EbayCategoriesSelect', () => ({
  EbayCategoriesSelect: (props: Record<string, unknown>) => {
    ebayCategoriesSelectSpy(props);
    return <div data-testid="ebay-categories-select">eBay categories select</div>;
  },
}));

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InventoryRecordEditor } from '@/components/tabs/airtable/InventoryRecordEditor';

describe('InventoryRecordEditor', () => {
  it('uses the shared Shopify tags editor for Shopify Tags fields', () => {
    const onFieldChange = vi.fn();

    render(
      <InventoryRecordEditor
        record={{
          id: 'rec-shopify-tags',
          createdTime: '2026-05-17T00:00:00.000Z',
          fields: {
            SKU: 'SL-1200G-S',
            'Shopify Tags': ['turntable'],
          },
        }}
        editableFields={[
          {
            id: 'fld-shopify-tags',
            name: 'Shopify Tags',
            type: 'multipleSelects',
            editable: true,
            choices: ['turntable', 'vintage', 'silver'],
          },
        ]}
        draftValues={{
          'Shopify Tags': ['turntable'],
        }}
        dirtyFieldNames={[]}
        loading={false}
        saving={false}
        error={null}
        saveMessage={null}
        onFieldChange={onFieldChange}
        onReset={vi.fn()}
        onReload={vi.fn()}
        onSave={vi.fn()}
        showIntro={false}
      />, 
    );

    expect(screen.getByLabelText('Add tag')).toBeInTheDocument();
    expect(screen.getByText('turntable')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Add tag'), { target: { value: 'silver' } });
    fireEvent.keyDown(screen.getByLabelText('Add tag'), { key: 'Enter' });

    expect(onFieldChange).toHaveBeenCalledWith('Shopify Tags', ['turntable', 'silver']);
  });

  it('groups fields into workflow sections and uses the shared eBay categories selector', async () => {
    ebayCategoriesSelectSpy.mockReset();

    render(
      <InventoryRecordEditor
        record={{
          id: 'rec-ebay-sections',
          createdTime: '2026-05-17T00:00:00.000Z',
          fields: {
            SKU: 'SL-1200G-S',
            Status: 'Ready to Test',
            'Ebay Categories': ['3276'],
            'Testing Notes': 'Passed playback test.',
            'Photography Cosmetic Notes': 'Capture top-panel scratches.',
            'Workflow Status': 'Testing In Progress',
          },
        }}
        editableFields={[
          { id: 'fld-status', name: 'Status', type: 'singleSelect', editable: true, choices: ['Ready to Test'] },
          { id: 'fld-ebay-categories', name: 'Ebay Categories', type: 'multipleSelects', editable: true, choices: [] },
          { id: 'fld-testing-notes', name: 'Testing Notes', type: 'multilineText', editable: true, choices: [] },
          { id: 'fld-photography-notes', name: 'Photography Cosmetic Notes', type: 'multilineText', editable: true, choices: [] },
          { id: 'fld-workflow-status', name: 'Workflow Status', type: 'singleSelect', editable: true, choices: ['Testing In Progress'] },
        ]}
        draftValues={{
          Status: 'Ready to Test',
          'Ebay Categories': ['3276'],
          'Testing Notes': 'Passed playback test.',
          'Photography Cosmetic Notes': 'Capture top-panel scratches.',
          'Workflow Status': 'Testing In Progress',
        }}
        dirtyFieldNames={[]}
        loading={false}
        saving={false}
        error={null}
        saveMessage={null}
        onFieldChange={vi.fn()}
        onReset={vi.fn()}
        onReload={vi.fn()}
        onSave={vi.fn()}
        showIntro={false}
      />,
    );

    expect(screen.getByText('Intake')).toBeInTheDocument();
    expect(screen.getByText('Testing')).toBeInTheDocument();
    expect(screen.getByText('Photography')).toBeInTheDocument();
    expect(screen.getByText('Listing')).toBeInTheDocument();
    expect(screen.getByText('Workflow')).toBeInTheDocument();
    expect(await screen.findByTestId('ebay-categories-select')).toBeInTheDocument();
    expect(ebayCategoriesSelectSpy).toHaveBeenCalledWith(expect.objectContaining({
      fieldName: 'Ebay Categories',
      label: 'Ebay Categories',
      marketplaceId: 'EBAY_US',
      value: ['3276'],
    }));
  });
});