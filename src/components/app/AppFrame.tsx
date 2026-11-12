import { useEffect, useRef, useState } from 'react';
import { AppFrameExportOverlay } from '@/components/app/AppFrameExportOverlay';
import { AppSidebar, type SidebarGroup } from '@/components/app/AppSidebar';
import { AppTopBar } from '@/components/app/AppTopBar';
import type { AppFrameProps, OpenDropdown } from '@/components/app/appFrameTypes';

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
  theme,
  onToggleTheme,
  exportProgress,
  exporting,
  children,
}: AppFrameProps) {
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null);
  const shellContainerRef = useRef<HTMLElement>(null);
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

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!shellContainerRef.current || !(event.target instanceof Node)) return;
      if (!shellContainerRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  function toggleDropdown(next: Exclude<OpenDropdown, null>) {
    setOpenDropdown((current) => (current === next ? null : next));
  }

  function closeDropdowns() {
    setOpenDropdown(null);
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
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopBar
          barRef={shellContainerRef}
          currentUserLabel={currentUserLabel}
          canManageUsers={canManageUsers}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onOpenMobileNav={() => setMobileOpen(true)}
          onOpenNotifications={onOpenNotifications}
          onOpenSettings={onOpenSettings}
          onOpenUserManagement={onOpenUserManagement}
          onLogout={onLogout}
          openDropdown={openDropdown}
          onToggleDropdown={toggleDropdown}
          onCloseDropdowns={closeDropdowns}
        />
        <section className="mx-auto w-full max-w-[1320px] px-4 pb-28 pt-6 sm:px-6 sm:pt-8">
          {exportProgress && <AppFrameExportOverlay exportProgress={exportProgress} />}
          {children}
        </section>
      </div>
    </main>
  );
}
