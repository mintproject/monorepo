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
    <nav aria-label="Sub-task steps" className="flex w-56 shrink-0 flex-col gap-0.5 border-r pr-2">
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
              'flex items-start gap-2 rounded px-3 py-2 text-left transition-colors',
              isActive && 'bg-blue-600 text-white',
              !isActive && st.status === 'done' && 'text-gray-800 hover:bg-gray-50',
              !isActive && st.status === 'upcoming' && 'text-gray-700 hover:bg-gray-50',
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
  );
}
