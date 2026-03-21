import { useEffect, useRef, useState } from 'react';
import { AppFrameExportOverlay } from '@/components/app/AppFrameExportOverlay';
import { AppFrameHeader } from '@/components/app/AppFrameHeader';
import type { AppFrameProps, OpenDropdown } from '@/components/app/appFrameTypes';

export function AppFrame({
  shellRef,
  currentUserLabel,
  tabs,
  postEbayTabs,
  ebayTabs,
  utilityTabs,
  refreshLabel,
  refreshDisabled,
  onRefresh,
  exportDisabled,
  onExportCurrentPage,
  onExportAllPages,
  onLogout,
  exportProgress,
  exporting,
  children,
}: AppFrameProps) {
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null);
  const shellContainerRef = useRef<HTMLElement>(null);

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
      className={[
        'dashboard-dark min-h-screen text-[var(--ink)]',
        '[--bg:#07111c] [--ink:#e8f1fb] [--muted:#92a7be] [--panel:#101a28] [--line:#25384b] [--accent:#68a4ff] [--error-bg:#37181d] [--error-text:#ffcdc7]',
        exporting ? 'cursor-progress' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <AppFrameHeader
        headerRef={shellContainerRef}
        currentUserLabel={currentUserLabel}
        tabs={tabs}
        postEbayTabs={postEbayTabs}
        ebayTabs={ebayTabs}
        utilityTabs={utilityTabs}
        refreshLabel={refreshLabel}
        refreshDisabled={refreshDisabled}
        onRefresh={onRefresh}
        exportDisabled={exportDisabled}
        onExportCurrentPage={onExportCurrentPage}
        onExportAllPages={onExportAllPages}
        onLogout={onLogout}
        openDropdown={openDropdown}
        onToggleDropdown={toggleDropdown}
        onCloseDropdowns={closeDropdowns}
      />

      <section className="mx-auto w-[min(1200px,96vw)] py-6 sm:py-8">
        {exportProgress && <AppFrameExportOverlay exportProgress={exportProgress} />}
        {children}
      </section>
    </main>
  );
}
