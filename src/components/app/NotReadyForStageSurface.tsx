import { ErrorSurface } from '@/components/app/StateSurfaces';
import type { ReactNode } from 'react';


interface NotReadyForStageSurfaceProps {
  stageLabel: string;
  nextStepLabel: string;
  onGoToNextStep: () => void;
  currentStepLabel?: string;
  children?: ReactNode;
}

export function NotReadyForStageSurface({
  stageLabel,
  nextStepLabel,
  onGoToNextStep,
  currentStepLabel,
  children,
}: NotReadyForStageSurfaceProps) {
  return (
    <ErrorSurface
      title={`Not Ready for ${stageLabel}`}
      message={`This item isn't ready for the ${stageLabel} step yet. It is currently in the "${currentStepLabel ?? 'Unknown'}" step. Complete the required previous steps to continue or go to the current step.`}
    >
      <div className="mt-4 flex flex-col items-start gap-2">
        <button
          type="button"
          onClick={onGoToNextStep}
          className="px-4 py-2 rounded-md bg-[var(--accent)]/10 text-[var(--accent)] font-semibold border border-[var(--accent)]/30 hover:bg-[var(--accent)]/20 transition"
        >
          Go to {nextStepLabel}
        </button>
        {children}
      </div>
    </ErrorSurface>
  );
}
