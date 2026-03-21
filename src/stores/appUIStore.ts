import { create } from 'zustand';

interface AppUIStore {
  exportingPdf: boolean;
  dashboardRefreshing: boolean;
  exportProgress: { current: number; total: number; label: string } | null;

  setExportingPdf: (value: boolean) => void;
  setDashboardRefreshing: (value: boolean) => void;
  setExportProgress: (progress: { current: number; total: number; label: string } | null) => void;
}

export const useAppUIStore = create<AppUIStore>((set) => ({
  exportingPdf: false,
  dashboardRefreshing: false,
  exportProgress: null,

  setExportingPdf: (value) => set({ exportingPdf: value }),
  setDashboardRefreshing: (value) => set({ dashboardRefreshing: value }),
  setExportProgress: (progress) => set({ exportProgress: progress }),
}));
