import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowGuideTab } from '@/components/tabs/WorkflowGuideTab';
import { DEFAULT_WORKFLOW_GUIDE_CONTENT } from '@/components/tabs/workflowGuideContent';

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

describe('WorkflowGuideTab', () => {
  beforeEach(() => {
    loadWorkflowGuideContentMock.mockReset();
    updateWorkflowGuideRecordMock.mockReset();
    loadWorkflowGuideContentMock.mockResolvedValue({
      content: DEFAULT_WORKFLOW_GUIDE_CONTENT,
      editableRecords: [],
      source: 'airtable',
    });
  });

  it('shows tester-specific guidance without account-summary modules', async () => {
    render(
      <WorkflowGuideTab
        currentUserRole="tester"
        currentUserName="Taylor Tester"
        accessiblePages={['dashboard', 'workflow-guide', 'testing-queue', 'testing']}
      />,
    );

    expect(await screen.findByText('Tester quick start')).toBeInTheDocument();
    expect(screen.getByText('Tester quick start')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'User Guide' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your Workflow Lane' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How Items Move To The Next Step' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'User guide sections' })).toBeInTheDocument();
    expect(screen.getByText('Record And Detail Pages')).toBeInTheDocument();
    expect(screen.getAllByText('Suggested start').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Start ready work here' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Open Testing Queue' })[0]).toHaveAttribute('href', '/testing');
    expect(screen.getAllByRole('link', { name: 'Open Testing' })[0]).toHaveAttribute('href', '/testing');
    expect(screen.getAllByText('Your lane').length).toBeGreaterThan(0);
    expect(screen.getAllByText('specialist').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Testing Queue').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Testing').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Testing Record Page' })).toBeInTheDocument();
    expect(screen.getAllByText('Arrival And Routing').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Testing Handoff').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Photography Handoff').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pre-List And Publish').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Testing Queue' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Testing' })).toBeInTheDocument();
    expect(screen.getAllByText('Modules On This Page').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Use It For').length).toBeGreaterThan(0);
    expect(screen.queryByText('Signed In')).not.toBeInTheDocument();
    expect(screen.queryByText('Pages In Your Account')).not.toBeInTheDocument();
    expect(screen.queryByText('Intake Arrives')).not.toBeInTheDocument();
    expect(screen.queryByText('Post-Publish Follow-Through')).not.toBeInTheDocument();
    expect(screen.queryByText('Side path')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Parking Lot' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Listings' })).not.toBeInTheDocument();
    expect(screen.queryByText('Where should I start if I am working intake?')).not.toBeInTheDocument();
  });

  it('shows processor guidance with flow stages that match processor responsibilities', async () => {
    render(
      <WorkflowGuideTab
        currentUserRole="processor"
        currentUserName="Pat Processor"
        accessiblePages={['dashboard', 'workflow-guide', 'jotform', 'inventory', 'parking-lot', 'testing-queue', 'testing', 'listings']}
      />,
    );

    expect(await screen.findByText('Processor quick start')).toBeInTheDocument();
    expect(screen.getByText('Processor quick start')).toBeInTheDocument();
    expect(screen.getByText('How To Use The Pages For This Role')).toBeInTheDocument();
    expect(screen.getByText('How Items Move To The Next Step')).toBeInTheDocument();
    expect(screen.getByText('Record And Detail Pages')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Start fresh intake here' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Open Parking Lot' })[0]).toHaveAttribute('href', '/parking-lot');
    expect(screen.getAllByRole('link', { name: 'Open Workflow Hub' })[0]).toHaveAttribute('href', '/workflow-hub');
    expect(screen.getAllByRole('link', { name: 'Open Listings' })[0]).toHaveAttribute('href', '/listings');
    expect(screen.getByRole('heading', { name: 'Parking Lot' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Workflow Hub' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Testing Queue' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Testing' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Listings' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Manual Intake' })[0]).toHaveAttribute('href', '/manual-intake');
    expect(screen.getAllByRole('link', { name: 'JotForm' })[0]).toHaveAttribute('href', '/jotform');
    expect(screen.getAllByRole('link', { name: 'Parking Lot' })[0]).toHaveAttribute('href', '/parking-lot');
    expect(screen.getAllByRole('link', { name: 'Testing' })[0]).toHaveAttribute('href', '/testing');
    expect(screen.getAllByRole('link', { name: 'Photography' })[0]).toHaveAttribute('href', '/photography');
    expect(screen.getAllByText(/JotForm/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Pending Review Record And Group Pages' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Workflow Snapshot And Record Pages' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Testing Record Page' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Listings Record Page' })).toBeInTheDocument();
    expect(screen.getAllByText('Arrival And Routing').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Testing Handoff').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Photography Handoff').length).toBeGreaterThan(0);
    expect(screen.getByText('Listings to live listing status')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Shopify Products' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'eBay' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Your lane').length).toBeGreaterThan(1);
    expect(screen.getByText('Where should I start if I am working intake?')).toBeInTheDocument();
  });

  it('shows a guide editor entry point for full-access roles without mixing editor controls into the reader page', async () => {
    loadWorkflowGuideContentMock.mockResolvedValue({
      content: DEFAULT_WORKFLOW_GUIDE_CONTENT,
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
      ],
    });

    render(
      <WorkflowGuideTab
        currentUserRole="admin"
        currentUserName="Taylor Admin"
        accessiblePages={['dashboard', 'workflow-guide', 'parking-lot', 'inventory', 'listings']}
      />,
    );

    expect(await screen.findByRole('link', { name: 'Open User Guide Admin' })).toHaveAttribute('href', '/workflow-guide/edit');
    expect(screen.queryByText('Guide Copy Admin')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save Guide Copy' })).not.toBeInTheDocument();
  });
});