import type { Thread } from '@/graphql/generated/modeling';
import type { StepState, WizardStepId } from './types';

export interface DeriveOpts {
  /** All required inputs assigned across all selected models. */
  datasetsComplete?: boolean;
  /** Parameter values valid for every model (defaults give a valid baseline). */
  parametersComplete?: boolean;
  /** >=1 successful run. */
  runsComplete?: boolean;
}

export type StepStateMap = Record<WizardStepId, StepState>;

export function deriveStepStates(thread: Thread, opts: DeriveOpts = {}): StepStateMap {
  const goalSet = !!thread.name?.trim();
  const modelCount = thread.thread_models?.length ?? 0;
  const modelsSet = modelCount >= 1;
  const datasetsSet = !!opts.datasetsComplete;
  const parametersSet = !!opts.parametersComplete;
  const runsSet = !!opts.runsComplete;

  const region = thread.region_id?.trim() || 'any region';
  const framingSummary = goalSet ? `${thread.name!.trim()} · ${region}` : 'Not set';
  const variablesSummary = thread.response_variable_id?.trim() || 'No indicator';

  // status helper: locked beats done beats upcoming
  const state = (done: boolean, locked: boolean, summary: string): StepState => ({
    status: locked ? 'locked' : done ? 'done' : 'upcoming',
    locked,
    summary,
  });

  return {
    framing: state(goalSet, false, framingSummary),
    variables: state(!!thread.response_variable_id, !goalSet, variablesSummary),
    models: state(
      modelsSet,
      !goalSet,
      modelsSet ? `${modelCount} model${modelCount === 1 ? '' : 's'}` : 'None',
    ),
    datasets: state(datasetsSet, !modelsSet, datasetsSet ? 'All inputs assigned' : 'Pending'),
    parameters: state(parametersSet, !datasetsSet, parametersSet ? 'Configured' : 'Pending'),
    runs: state(runsSet, !parametersSet, runsSet ? 'Complete' : 'Pending'),
    results: state(false, !runsSet, 'Pending'),
    summary: state(false, false, 'Review'),
  };
}
