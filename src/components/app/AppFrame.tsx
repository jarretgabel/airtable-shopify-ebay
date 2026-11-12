import { useState } from 'react';
import { AppFrameExportOverlay } from '@/components/app/AppFrameExportOverlay';
import { AppSidebar, type SidebarGroup } from '@/components/app/AppSidebar';
import { NavIcon } from '@/components/app/navIcons';
import type { AppFrameProps } from '@/components/app/appFrameTypes';

const SIDEBAR_COLLAPSED_KEY = 'app.sidebarCollapsed';

export function AppFrame({
  shellRef,
  currentUserLabel,
  tabs,
  intakeTabs,
  listingsTabs,
  postPublishTabs,
  inventoryProcessingTabs,
  postEbayTabs,
  businessTabs,
  utilityTabs,
  exportDisabled,
  onExportCurrentPage,
  onExportAllPages,
  onOpenNotifications,
  onOpenSettings,
  onOpenUserManagement,
  canManageUsers,
  onLogout,
  exportProgress,
  exporting,
  children,
}: AppFrameProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const groups: SidebarGroup[] = [
    { id: 'main', title: 'Main', tabs },
    { id: 'business', title: 'Business', tabs: businessTabs ?? [] },
    { id: 'intake', title: 'Intake', tabs: intakeTabs },
    { id: 'processing', title: 'Processing', tabs: inventoryProcessingTabs },
    { id: 'selling', title: 'Selling', tabs: [...listingsTabs, ...postPublishTabs, ...postEbayTabs] },
    { id: 'utilities', title: 'Utilities', tabs: utilityTabs },
  ].filter((group) => group.tabs.length > 0);

  function toggleCollapsed() {
    setCollapsed((current) => {
      try { window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, current ? '0' : '1'); } catch { /* preference is optional */ }
      return !current;
    });
  }

  return (
    <main
      ref={shellRef}
      className={['dashboard-dark flex min-h-screen text-[var(--ink)]', exporting ? 'cursor-progress' : ''].filter(Boolean).join(' ')}
    >
      <AppSidebar
        groups={groups}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        exportDisabled={exportDisabled}
        onToggleCollapsed={toggleCollapsed}
        onCloseMobile={() => setMobileOpen(false)}
        onExportCurrentPage={onExportCurrentPage}
        onExportAllPages={onExportAllPages}
        currentUserLabel={currentUserLabel}
        canManageUsers={canManageUsers}
        onOpenNotifications={onOpenNotifications}
        onOpenSettings={onOpenSettings}
        onOpenUserManagement={onOpenUserManagement}
        onLogout={onLogout}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 bg-[var(--header-surface)] px-4 backdrop-blur-md md:hidden" data-export-ignore="true">
          <button
            type="button"
            aria-label="Open navigation menu"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--ink)]"
          >
            <NavIcon page="menu" className="h-5 w-5" />
          </button>
          <span className="text-[0.95rem] font-bold tracking-[0.02em] text-[var(--ink)]">ResolutionAV</span>
        </header>
        <section className="mx-auto w-full max-w-[1320px] px-5 pb-28 pt-8 sm:px-8 md:px-10 md:pt-12">
          {exportProgress && <AppFrameExportOverlay exportProgress={exportProgress} />}
          {children}
        </section>
      </div>
    </main>
  );
}
