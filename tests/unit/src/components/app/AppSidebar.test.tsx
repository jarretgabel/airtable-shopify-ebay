import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppSidebar } from '@/components/app/AppSidebar';
import type { AppTab } from '@/components/app/appFrameTypes';

function tab(key: AppTab['key'], label: string, extra: Partial<AppTab> = {}): AppTab {
  return { key, label, active: false, onClick: vi.fn(), ...extra };
}

function renderSidebar(props: Partial<Parameters<typeof AppSidebar>[0]> = {}) {
  const dashboard = tab('dashboard', 'Dashboard', { active: true });
  const jotform = tab('jotform', 'JotForm');
  const issues = tab('issues', 'Issues', { badgeCount: 2 });
  render(
    <AppSidebar
      groups={[
        { id: 'main', title: 'Main', tabs: [dashboard] },
        { id: 'intake', title: 'Intake', tabs: [jotform] },
        { id: 'utilities', title: 'Utilities', tabs: [issues] },
      ]}
      collapsed={false}
      mobileOpen={false}
      exportDisabled={false}
      onToggleCollapsed={vi.fn()}
      onCloseMobile={vi.fn()}
      onExportCurrentPage={vi.fn()}
      onExportAllPages={vi.fn()}
      {...props}
    />,
  );
  return { dashboard, jotform, issues };
}

describe('AppSidebar', () => {
  it('shows main tabs, collapses other groups until opened, and navigates', () => {
    const { jotform } = renderSidebar();
    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('button', { name: 'JotForm' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Intake/ }));
    fireEvent.click(screen.getByRole('button', { name: 'JotForm' }));
    expect(jotform.onClick).toHaveBeenCalled();
  });

  it('shows a group badge while the group is closed', () => {
    renderSidebar();
    expect(screen.getByRole('button', { name: /Utilities/ })).toHaveTextContent('2');
  });

  it('renders every page as an icon rail when collapsed and toggles', () => {
    const onToggleCollapsed = vi.fn();
    renderSidebar({ collapsed: true, onToggleCollapsed });
    expect(screen.getByRole('button', { name: 'JotForm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Issues' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(onToggleCollapsed).toHaveBeenCalled();
  });
});
