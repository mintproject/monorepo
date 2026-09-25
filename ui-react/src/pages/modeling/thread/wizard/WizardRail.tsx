import { cn } from '@/lib/utils';
import type { StepStateMap } from './deriveStepStates';
import { WIZARD_STEPS, type StepStatus, type WizardStepId } from './types';

interface WizardRailProps {
  states: StepStateMap;
  currentStep: WizardStepId;
  onSelect: (step: WizardStepId) => void;
}

const GLYPH: Record<StepStatus | 'active', string> = {
  done: '✓',
  active: '●',
  upcoming: '○',
  locked: '🔒',
};

export function WizardRail({ states, currentStep, onSelect }: WizardRailProps) {
  return (
    <details open className="mt-4 rounded-lg border border-gray-200 bg-gray-50">
      <summary
        data-testid="subtask-steps-toggle"
        className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium text-gray-700 [&::-webkit-details-marker]:hidden"
      >
        <span>Sub-task steps</span>
        <span className="truncate text-xs font-normal text-gray-500">
          Current: {WIZARD_STEPS.find((step) => step.id === currentStep)?.label ?? currentStep}
        </span>
      </summary>
      <nav aria-label="Sub-task steps" className="grid gap-1 border-t border-gray-200 p-2">
        {WIZARD_STEPS.map((step) => {
          const st = states[step.id];
          const isActive = step.id === currentStep;
          const glyph = isActive ? GLYPH.active : GLYPH[st.status];

          return (
            <button
              key={step.id}
              type="button"
              data-testid={`rail-step-${step.id}`}
              aria-current={isActive ? 'step' : undefined}
              disabled={st.locked}
              onClick={() => !st.locked && onSelect(step.id)}
              className={cn(
                'flex min-w-0 items-start gap-2 rounded px-2.5 py-2 text-left transition-colors',
                isActive && 'bg-blue-600 text-white',
                !isActive && st.status === 'done' && 'text-gray-800 hover:bg-white',
                !isActive && st.status === 'upcoming' && 'text-gray-700 hover:bg-white',
                !isActive && st.locked && 'cursor-not-allowed text-gray-300',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 shrink-0 text-sm font-bold',
                  !isActive && st.status === 'done' && 'text-green-600',
                )}
                aria-hidden
              >
                {glyph}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{step.label}</span>
                <span
                  className={cn(
                    'block truncate text-xs',
                    isActive ? 'text-blue-100' : 'text-gray-400',
                  )}
                >
                  {st.summary}
                </span>
              </span>
            </button>
          );
        })}
      </nav>
    </details>
  );
}
