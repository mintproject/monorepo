/** The atomic wizard steps, in order. 'framing' replaces the legacy 'configure'. */
export type WizardStepId =
  | 'framing'
  | 'variables'
  | 'models'
  | 'datasets'
  | 'parameters'
  | 'runs'
  | 'results'
  | 'summary';

/** Per-step status. 'active' is layered on by the rail from currentStep, not by derivation. */
export type StepStatus = 'done' | 'upcoming' | 'locked';

export interface StepState {
  status: StepStatus;
  /** One-line summary of the choice made, shown under the step name in the rail. */
  summary: string;
  locked: boolean;
}

export interface WizardStep {
  id: WizardStepId;
  label: string;
}

export const WIZARD_STEPS: WizardStep[] = [
  { id: 'framing', label: 'Framing' },
  { id: 'variables', label: 'Variables' },
  { id: 'models', label: 'Models' },
  { id: 'datasets', label: 'Datasets' },
  { id: 'parameters', label: 'Parameters' },
  { id: 'runs', label: 'Runs' },
  { id: 'results', label: 'Results' },
  { id: 'summary', label: 'Summary' },
];
