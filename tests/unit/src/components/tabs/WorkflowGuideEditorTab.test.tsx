import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowGuideEditorTab } from '@/components/tabs/WorkflowGuideEditorTab';

const { loadWorkflowGuideContentMock, updateWorkflowGuideRecordMock } = vi.hoisted(() => ({
  loadWorkflowGuideContentMock: vi.fn(),
  updateWorkflowGuideRecordMock: vi.fn(),
}));

vi.mock('@/services/userGuideContent', () => ({
  loadWorkflowGuideContent: loadWorkflowGuideContentMock,
  updateWorkflowGuideRecord: updateWorkflowGuideRecordMock,
  getUserGuideEditableFields: (contentType: string) => {
    if (contentType === 'role-guide') {
      return [
        { name: 'Role Summary', label: 'Role Summary', multiline: true },
        { name: 'Quick Start Title', label: 'Quick Start Title', multiline: false },
      ];
    }

    return [{ name: 'Summary', label: 'Summary', multiline: true }];
  },
}));

describe('WorkflowGuideEditorTab', () => {
  beforeEach(() => {
    loadWorkflowGuideContentMock.mockReset();
    updateWorkflowGuideRecordMock.mockReset();
    loadWorkflowGuideContentMock.mockResolvedValue({
      content: {},
      source: 'airtable',
      editableRecords: [
        {
          id: 'rec-role-admin',
          name: 'Admin quick start',
          contentKey: 'role-guide.admin',
          contentType: 'role-guide',
          sortOrder: 10,
          fieldValues: {
            'Role Summary': 'Admin role summary from Airtable.',
            'Quick Start Title': 'Admin quick start',
          },
        },
        {
          id: 'rec-page-testing',
          name: 'Testing Queue',
          contentKey: 'page-guide.testing-queue',
          contentType: 'page-guide',
          sortOrder: 20,
          fieldValues: {
            Summary: 'Testing queue summary.',
          },
        },
        {
          id: 'rec-page-photos',
          name: 'Photos',
          contentKey: 'page-guide.photos',
          contentType: 'page-guide',
          sortOrder: 30,
          fieldValues: {
            Summary: 'Photos page summary.',
          },
        },
      ],
    });
  });

  it('uses a two-step section and item flow, then saves the selected record', async () => {
    updateWorkflowGuideRecordMock.mockResolvedValue(undefined);

    render(<WorkflowGuideEditorTab currentUserRole="owner" />);

    expect(await screen.findByRole('heading', { name: 'User Guide Admin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to User Guide' })).toBeInTheDocument();
    expect(screen.getByText('Only admins, owners, and developers can edit User Guide copy here')).toBeInTheDocument();
    expect(screen.getByText('Content Section')).toBeInTheDocument();
    expect(screen.getByText('Pick a section, then choose the specific guide block to edit.')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'User guide admin sections' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Role Guides By Audience' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page Guides' })).toBeInTheDocument();
    expect(screen.getByText('Edit access:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Admin quick start/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Testing Queue/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Page Guides' }));

    expect(await screen.findByRole('button', { name: /Testing Queue/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Photos/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Admin quick start/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Role Guides By Audience' }));
    expect(await screen.findByRole('button', { name: /Admin quick start/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Admin quick start/ }));

    const quickStartTitleInput = screen.getByLabelText('Quick Start Title');
    fireEvent.change(quickStartTitleInput, { target: { value: 'Admin quick start updated' } });

    await waitFor(() => {
      expect(quickStartTitleInput).toHaveValue('Admin quick start updated');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save Guide Copy' }));

    await waitFor(() => {
      expect(updateWorkflowGuideRecordMock).toHaveBeenCalledWith('rec-role-admin', expect.objectContaining({
        'Quick Start Title': 'Admin quick start updated',
      }));
    });
  });

  it('does not surface internal Airtable metadata in the editor UI', async () => {
    render(<WorkflowGuideEditorTab currentUserRole="developer" />);

    expect(await screen.findByRole('heading', { name: 'User Guide Admin' })).toBeInTheDocument();
    expect(screen.queryByText('Advanced Airtable details')).not.toBeInTheDocument();
    expect(screen.queryByText(/Content Key:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Type:/)).not.toBeInTheDocument();
    expect(screen.queryByText('role-guide.admin')).not.toBeInTheDocument();
    expect(screen.queryByText('role-guide')).not.toBeInTheDocument();
  });
});