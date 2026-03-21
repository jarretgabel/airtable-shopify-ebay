import { PAGE_DEFINITIONS } from '@/auth/pages';
import { appendElementToPdf, createPdfDocumentAsync } from '@/services/pdfExport';
import { Tab, waitForScreenRender } from './appNavigation';

interface ExportPdfInput {
  activeTab: Tab;
  canAccessPage: (tab: Tab) => boolean;
  exportingPdf: boolean;
  setExportingPdf: (value: boolean) => void;
  setExportProgress: (value: { current: number; total: number; label: string } | null) => void;
  shellElement: HTMLElement | null;
  navigateToTab: (tab: Tab, replace?: boolean) => void;
}

export async function exportPdf(
  mode: 'current' | 'all',
  allTabs: Tab[],
  input: ExportPdfInput,
): Promise<void> {
  const {
    activeTab,
    canAccessPage,
    exportingPdf,
    setExportingPdf,
    setExportProgress,
    shellElement,
    navigateToTab,
  } = input;

  if (exportingPdf || !shellElement) {
    return;
  }

  const exportTabs =
    mode === 'all' ? allTabs.filter((tab) => canAccessPage(tab)) : canAccessPage(activeTab) ? [activeTab] : [];

  if (exportTabs.length === 0) {
    return;
  }

  const previousTab = activeTab;
  const previousScrollX = window.scrollX;
  const previousScrollY = window.scrollY;

  setExportingPdf(true);

  try {
    const pdf = await createPdfDocumentAsync();
    let firstScreen = true;
    const exportedAt = new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    for (const [index, tab] of exportTabs.entries()) {
      const exportLabel = PAGE_DEFINITIONS[tab].label;
      setExportProgress({
        current: index + 1,
        total: exportTabs.length,
        label: exportLabel,
      });
      navigateToTab(tab, true);
      await waitForScreenRender();

      if (!shellElement) continue;

      await appendElementToPdf(pdf, shellElement, firstScreen, {
        title: exportLabel,
        subtitle: 'Listing Control Center export',
        exportedAt,
      });
      firstScreen = false;
    }

    pdf.save(`listing-control-center-${new Date().toISOString().slice(0, 10)}.pdf`);
  } finally {
    navigateToTab(previousTab, true);
    await waitForScreenRender();
    window.scrollTo(previousScrollX, previousScrollY);
    setExportProgress(null);
    setExportingPdf(false);
  }
}
