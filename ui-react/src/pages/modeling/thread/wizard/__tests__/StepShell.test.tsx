import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepShell } from '../StepShell';

describe('StepShell', () => {
  it('renders title, description and children', () => {
    render(
      <StepShell title="Framing" description="Set the scope">
        <p>body</p>
      </StepShell>,
    );
    expect(screen.getByRole('heading', { name: 'Framing' })).toBeInTheDocument();
    expect(screen.getByText('Set the scope')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('disables Continue until canContinue is true and shows the hint', () => {
    render(
      <StepShell
        title="Models"
        canContinue={false}
        continueHint="0 of 1 selected"
        onContinue={vi.fn()}
      >
        x
      </StepShell>,
    );
    expect(screen.getByTestId('step-continue')).toBeDisabled();
    expect(screen.getByText('0 of 1 selected')).toBeInTheDocument();
  });

  it('fires onContinue when enabled and onBack when Back clicked', async () => {
    const onContinue = vi.fn();
    const onBack = vi.fn();
    render(
      <StepShell title="Models" canContinue onContinue={onContinue} onBack={onBack}>
        x
      </StepShell>,
    );
    await userEvent.click(screen.getByTestId('step-continue'));
    expect(onContinue).toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('step-back'));
    expect(onBack).toHaveBeenCalled();
  });

  it('hides Back when onBack is not provided', () => {
    render(
      <StepShell title="Framing" canContinue onContinue={vi.fn()}>
        x
      </StepShell>,
    );
    expect(screen.queryByTestId('step-back')).not.toBeInTheDocument();
  });
});
