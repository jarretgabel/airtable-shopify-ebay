import type { ReactNode, Ref } from 'react';
import type { AppPage } from '@/auth/pages';

export interface AppTab {
  key: AppPage;
  label: string;
  active: boolean;
  badgeCount?: number;
  disabled?: boolean;
  onClick: () => void;
}

export interface ExportProgress {
  current: number;
  total: number;
  label: string;
}

export interface AppFrameProps {
  shellRef?: Ref<HTMLElement>;
  currentUserLabel: string;
  tabs: AppTab[];
  postEbayTabs: AppTab[];
  ebayTabs: AppTab[];
  utilityTabs: AppTab[];
  refreshLabel: string;
  refreshDisabled: boolean;
  onRefresh: () => void;
  exportDisabled: boolean;
  onExportCurrentPage: () => void;
  onExportAllPages: () => void;
  onLogout: () => void;
  exportProgress: ExportProgress | null;
  exporting: boolean;
  children: ReactNode;
}

export type OpenDropdown = 'pdf' | 'ebay' | 'utilities' | null;