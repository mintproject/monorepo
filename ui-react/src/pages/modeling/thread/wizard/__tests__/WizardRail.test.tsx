import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WizardRail } from '../WizardRail';
import type { StepStateMap } from '../deriveStepStates';

const states: StepStateMap = {
  framing: { status: 'done', locked: false, summary: 'Flood extent · Texas Gulf' },
  variables: { status: 'upcoming', locked: false, summary: 'No indicator' },
  models: { status: 'upcoming', locked: false, summary: 'None' },
  datasets: { status: 'locked', locked: true, summary: 'Pending' },
  parameters: { status: 'locked', locked: true, summary: 'Pending' },
  runs: { status: 'locked', locked: true, summary: 'Pending' },
  results: { status: 'locked', locked: true, summary: 'Pending' },
  summary: { status: 'upcoming', locked: false, summary: 'Review' },
};

describe('WizardRail', () => {
  it('renders each step name and its one-line summary', () => {
    render(<WizardRail states={states} currentStep="models" onSelect={vi.fn()} />);
    expect(screen.getByText('Framing')).toBeInTheDocument();
    expect(screen.getByText('Flood extent · Texas Gulf')).toBeInTheDocument();
    expect(screen.getByText('Datasets')).toBeInTheDocument();
  });

  it('marks the current step with aria-current', () => {
    render(<WizardRail states={states} currentStep="models" onSelect={vi.fn()} />);
    expect(screen.getByTestId('rail-step-models')).toHaveAttribute('aria-current', 'step');
  });

  it('calls onSelect for an unlocked step', async () => {
    const onSelect = vi.fn();
    render(<WizardRail states={states} currentStep="models" onSelect={onSelect} />);
    await userEvent.click(screen.getByTestId('rail-step-variables'));
    expect(onSelect).toHaveBeenCalledWith('variables');
  });

  it('does not call onSelect for a locked step and disables it', async () => {
    const onSelect = vi.fn();
    render(<WizardRail states={states} currentStep="models" onSelect={onSelect} />);
    const locked = screen.getByTestId('rail-step-datasets');
    expect(locked).toBeDisabled();
    await userEvent.click(locked);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
