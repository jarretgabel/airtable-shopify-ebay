import type { ReactNode } from 'react';
import type { ExportProgress } from '@/components/app/appFrameTypes';

export function AppFrameExportOverlay({ exportProgress }: { exportProgress: ExportProgress }): ReactNode {
  const width = `${Math.round((exportProgress.current / exportProgress.total) * 100)}%`;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/65 p-6 backdrop-blur-sm" data-export-ignore="true">
      <div className="w-full max-w-[480px] rounded-[28px] border border-sky-400/20 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.2),transparent_58%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))] p-7 shadow-[0_28px_70px_rgba(2,6,23,0.48)]">
        <p className="mb-2 text-[0.72rem] uppercase tracking-[0.22em] text-sky-300">Preparing PDF export</p>
        <h2 className="text-[clamp(1.5rem,2.2vw,2rem)] font-semibold leading-[1.05] text-slate-50">{exportProgress.label}</h2>
        <p className="mt-3 leading-6 text-slate-300">
          Capturing screen {exportProgress.current} of {exportProgress.total} and adding it to a single PDF.
        </p>
        <div className="mt-5 h-2.5 overflow-hidden rounded-full border border-slate-400/15 bg-slate-800/90">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-sky-400 shadow-[0_0_24px_rgba(56,189,248,0.35)] transition-[width] duration-200 ease-out"
            style={{ width }}
          />
        </div>
      </div>
    </div>
  );
}