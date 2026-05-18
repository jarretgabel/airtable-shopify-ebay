import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InventoryDirectoryListSection } from '@/components/tabs/airtable/InventoryDirectoryListSection';

describe('InventoryDirectoryListSection', () => {
  it('renders record directory statuses as chips in their own column', () => {
    render(
      <InventoryDirectoryListSection
        records={[
          {
            id: 'rec-directory-1',
            createdTime: '2026-05-07T00:00:00.000Z',
            fields: {
              SKU: 'DIR-1',
              Make: 'McIntosh',
              Model: 'MC240',
              'Component Type': 'Amplifier',
              Status: 'Testing and Photography In Progress',
              'Arrival Date': '2026-05-06',
            },
          },
        ]}
        totalCount={1}
        searchTerm=""
        statusFilter="all"
        statusOptions={['Testing and Photography In Progress']}
        onSearchTermChange={vi.fn()}
        onStatusFilterChange={vi.fn()}
        onRefresh={vi.fn()}
        onSelectRecord={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('columnheader', { name: /Status/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('columnheader', { name: /Intake/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Testing and Photography In Progress').length).toBeGreaterThan(0);
    expect(screen.getByText('May 6, 2026')).toBeInTheDocument();
    expect(screen.queryByText('Amplifier')).not.toBeInTheDocument();
  });

  it('passes through the status filter and row actions', () => {
    const onStatusFilterChange = vi.fn();
    const onSelectRecord = vi.fn();

    render(
      <InventoryDirectoryListSection
        records={[
          {
            id: 'rec-directory-2',
            createdTime: '2026-05-07T00:00:00.000Z',
            fields: {
              SKU: 'DIR-2',
              Make: 'Pioneer',
              Model: 'SX-1250',
              Component: 'Receiver',
              Status: 'Approved for Publish',
            },
          },
        ]}
        totalCount={1}
        searchTerm=""
        statusFilter="all"
        statusOptions={['Approved for Publish']}
        onSearchTermChange={vi.fn()}
        onStatusFilterChange={onStatusFilterChange}
        onRefresh={vi.fn()}
        onSelectRecord={onSelectRecord}
      />,
    );

    fireEvent.change(screen.getByLabelText('Filter inventory by status'), { target: { value: 'Approved for Publish' } });
    expect(onStatusFilterChange).toHaveBeenCalledWith('Approved for Publish');

    expect(screen.queryByRole('button', { name: 'Open Testing' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Photos' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Workflow Snapshot' }));
    expect(onSelectRecord).toHaveBeenCalledWith('rec-directory-2');
  });

  it('falls back to item title and workflow status when make/model are missing', () => {
    render(
      <InventoryDirectoryListSection
        records={[
          {
            id: 'rec-directory-3',
            createdTime: '2026-05-11T00:00:00.000Z',
            fields: {
              SKU: 'DIR-3',
              'Item Title': 'Thorens TD 124 Vintage Turntable',
              'Workflow Status': 'Approved for Publish',
            },
          },
        ]}
        totalCount={1}
        searchTerm=""
        statusFilter="all"
        statusOptions={['Approved for Publish']}
        onSearchTermChange={vi.fn()}
        onStatusFilterChange={vi.fn()}
        onRefresh={vi.fn()}
        onSelectRecord={vi.fn()}
      />,
    );

    expect(screen.getByText('DIR-3')).toBeInTheDocument();
    expect(screen.getByText('Thorens TD 124 Vintage Turntable')).toBeInTheDocument();
    expect(screen.getAllByText('Approved for Publish').length).toBeGreaterThan(0);
  });
});