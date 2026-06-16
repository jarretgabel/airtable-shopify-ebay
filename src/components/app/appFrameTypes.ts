import type { ReactNode, Ref } from 'react';
import type { AppPage } from '@/auth/pages';
import type { AppTheme } from '@/services/themePreference';

export interface AppTab {
  key: AppPage;
  label: string;
  active: boolean;
  badgeCount?: number;
  disabled?: boolean;
  disabledReason?: string;
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
  intakeTabs: AppTab[];
  listingsTabs: AppTab[];
  postPublishTabs: AppTab[];
  inventoryProcessingTabs: AppTab[];
  postEbayTabs: AppTab[];
  utilityTabs: AppTab[];
  exportDisabled: boolean;
  onExportCurrentPage: () => void;
  onExportAllPages: () => void;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  onOpenUserManagement: () => void;
  canManageUsers: boolean;
  onLogout: () => void;
  theme: AppTheme;
  onToggleTheme: () => void;
  exportProgress: ExportProgress | null;
  exporting: boolean;
  children: ReactNode;
}

export type OpenDropdown = 'intake' | 'listings' | 'inventory-processing' | 'utilities' | 'notifications' | 'account' | 'mobile-nav' | null;