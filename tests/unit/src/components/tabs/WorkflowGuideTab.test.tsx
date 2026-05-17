import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WorkflowGuideTab } from '@/components/tabs/WorkflowGuideTab';

describe('WorkflowGuideTab', () => {
  it('shows tester-specific guidance without account-summary modules', () => {
    render(
      <WorkflowGuideTab
        currentUserRole="tester"
        currentUserName="Taylor Tester"
        accessiblePages={['dashboard', 'workflow-guide', 'testing-queue', 'testing']}
      />,
    );

    expect(screen.getByText('Tester quick start')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'User Guide' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your Workflow Lane' })).toBeInTheDocument();
    expect(screen.getAllByText('Your lane').length).toBeGreaterThan(0);
    expect(screen.getAllByText('specialist').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Testing Queue').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Testing').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Arrival And Routing').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Testing Handoff').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Photography Handoff').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pre-List And Publish').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Testing Queue And Record' })).toBeInTheDocument();
    expect(screen.queryByText('Signed In')).not.toBeInTheDocument();
    expect(screen.queryByText('Pages In Your Account')).not.toBeInTheDocument();
    expect(screen.queryByText('Intake Arrives')).not.toBeInTheDocument();
    expect(screen.queryByText('Post-Publish Follow-Through')).not.toBeInTheDocument();
    expect(screen.queryByText('Side path')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Parking Lot 1' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Listings And Channel Views' })).not.toBeInTheDocument();
    expect(screen.queryByText('Where should I start if I am working intake?')).not.toBeInTheDocument();
  });

  it('shows processor guidance with flow stages that match processor responsibilities', () => {
    render(
      <WorkflowGuideTab
        currentUserRole="processor"
        currentUserName="Pat Processor"
        accessiblePages={['dashboard', 'workflow-guide', 'inventory', 'parking-lot-1', 'testing-queue', 'testing', 'listings']}
      />,
    );

    expect(screen.getByText('Processor quick start')).toBeInTheDocument();
    expect(screen.getByText('How To Use The Pages For This Role')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Parking Lot 1' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Workflow Hub' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Listings Review And Channel Views' })).toBeInTheDocument();
    expect(screen.getAllByText('Arrival And Routing').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Testing Handoff').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Photography Handoff').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Your lane').length).toBeGreaterThan(1);
    expect(screen.getByText('Where should I start if I am working intake?')).toBeInTheDocument();
  });
});