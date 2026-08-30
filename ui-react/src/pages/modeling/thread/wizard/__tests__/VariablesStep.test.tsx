import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils/render';
import type { Thread } from '@/graphql/generated/modeling';
import { VariablesStep } from '../VariablesStep';

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    __typename: 'thread',
    id: 't1',
    name: 'Flood extent',
    task_id: 'task1',
    start_date: '2000-01-01',
    end_date: '2026-01-01',
    region_id: null,
    driving_variable_id: null,
    response_variable_id: null,
    events: [],
    permissions: [
      { __typename: 'thread_permission', user_id: 'testuser', read: true, write: true },
    ],
    thread_models: [],
    ...overrides,
  };
}

describe('VariablesStep', () => {
  it('keeps Continue enabled even with no indicator (step is skippable)', () => {
    renderWithProviders(
      <VariablesStep
        thread={makeThread()}
        onUpdated={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByTestId('step-continue')).toBeEnabled();
  });

  it('shows the neutral "no indicator" preview when none is set', () => {
    renderWithProviders(
      <VariablesStep
        thread={makeThread()}
        onUpdated={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText(/no indicator set/i)).toBeInTheDocument();
  });

  // #106: the thread stores a standard variable URI. Showing that URI in the
  // combobox trigger is unreadable, so the relationship's label is preferred.
  it('shows the stored indicator by label, not by its URI', () => {
    renderWithProviders(
      <VariablesStep
        thread={makeThread({
          response_variable_id: 'https://w3id.org/okn/i/mint/DRAWDOWN',
          response_variable: {
            __typename: 'modelcatalog_standard_variable',
            id: 'https://w3id.org/okn/i/mint/DRAWDOWN',
            label: 'drawdown',
          },
        })}
        onUpdated={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText(/models will be filtered/i)).toHaveTextContent('drawdown');
    expect(screen.queryByText(/w3id\.org/)).not.toBeInTheDocument();
  });

  it('falls back to the id when the standard variable carries no label', () => {
    renderWithProviders(
      <VariablesStep
        thread={makeThread({ response_variable_id: 'https://w3id.org/okn/i/mint/DRAWDOWN' })}
        onUpdated={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText(/models will be filtered/i)).toHaveTextContent(
      'https://w3id.org/okn/i/mint/DRAWDOWN',
    );
  });

  it('renders both the indicator and adjustable-variable labels', () => {
    renderWithProviders(
      <VariablesStep
        thread={makeThread()}
        onUpdated={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('Indicator')).toBeInTheDocument();
    expect(screen.getByText('Adjustable variable')).toBeInTheDocument();
  });
});
