import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface StepShellProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Continue is enabled only when true. Defaults to true (optional/review steps). */
  canContinue?: boolean;
  /** Live progress hint shown next to Continue (e.g. "1 of 3 inputs assigned"). */
  continueHint?: string;
  /** Continue button label. */
  continueLabel?: string;
  onContinue?: () => void;
  /** When provided, a Back button is shown. */
  onBack?: () => void;
}

export function StepShell({
  title,
  description,
  children,
  canContinue = true,
  continueHint,
  continueLabel = 'Continue',
  onContinue,
  onBack,
}: StepShellProps) {
  return (
    <div className="flex min-h-full flex-col" data-testid="step-shell">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
      </div>

      <div className="flex-1">{children}</div>

      <div className="sticky bottom-0 z-10 mt-6 flex items-center gap-3 border-t bg-white pb-2 pt-4">
        {onBack && (
          <Button type="button" variant="outline" data-testid="step-back" onClick={onBack}>
            Back
          </Button>
        )}
        <div className="flex-1" />
        {continueHint && <span className="text-xs text-gray-500">{continueHint}</span>}
        {onContinue && (
          <Button
            type="button"
            data-testid="step-continue"
            disabled={!canContinue}
            onClick={onContinue}
          >
            {continueLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
