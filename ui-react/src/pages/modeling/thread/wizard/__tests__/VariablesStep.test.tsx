import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from '@/test/utils/render';
import type { Thread } from '@/graphql/generated/modeling';
import {
  GetDriverVariableOptionsDocument,
  GetIndicatorVariableOptionsDocument,
} from '@/graphql/generated/graphql';
import { VariablesStep } from '../VariablesStep';

/** Each picker asks a different query; the footer names which list it got. */
const scopeMocks = [
  {
    request: { query: GetIndicatorVariableOptionsDocument },
    result: { data: { modelcatalog_dataset_specification_presentation: [] } },
  },
  {
    request: { query: GetDriverVariableOptionsDocument },
    result: { data: { inputs: [], adjusted: [] } },
  },
];

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

  it('shows the neutral "no desired outcome" preview when none is set', () => {
    renderWithProviders(
      <VariablesStep
        thread={makeThread()}
        onUpdated={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText(/no desired outcome selected/i)).toBeInTheDocument();
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

  it('renders the response and driver labels', () => {
    renderWithProviders(
      <VariablesStep
        thread={makeThread()}
        onUpdated={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('Desired outcome (response variable)')).toBeInTheDocument();
    expect(screen.getByText('Potential driver')).toBeInTheDocument();
  });

  // ── Scoping the two pickers (monorepo#103) ────────────────────────────────
  //
  // At TACC the catalog holds 668 standard variables. 147 are produced by a
  // model the Models step lists; 161 are taken as an input or adjusted by a
  // parameter. The step must ask each picker for its own list, or 78% of
  // indicator choices dead-end at the next step.

  it('asks the Indicator picker for the variables a model produces', async () => {
    renderWithProviders(
      <VariablesStep
        thread={makeThread()}
        onUpdated={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
      { apolloMocks: scopeMocks },
    );
    const [indicatorTrigger] = screen.getAllByRole('combobox');
    await userEvent.click(indicatorTrigger!);
    expect(await screen.findByRole('button', { name: /a model produces/i })).toBeInTheDocument();
  });

  it('asks the Potential driver picker for the variables a model uses or adjusts', async () => {
    renderWithProviders(
      <VariablesStep
        thread={makeThread()}
        onUpdated={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
      { apolloMocks: scopeMocks },
    );
    const adjustableTrigger = screen.getAllByRole('combobox')[1];
    await userEvent.click(adjustableTrigger!);
    expect(
      await screen.findByRole('button', { name: /a model uses or adjusts/i }),
    ).toBeInTheDocument();
  });

  it('surfaces inputs from selected models as driver shortcuts', () => {
    renderWithProviders(
      <VariablesStep
        thread={makeThread()}
        modelDriverOptions={[
          { id: 'sv-precip', label: 'precipitation', description: null },
          { id: 'sv-soil', label: 'soil moisture', description: null },
          { id: 'sv-precip', label: 'precipitation duplicate', description: null },
        ]}
        onUpdated={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText('Inputs from selected models')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'precipitation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'soil moisture' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'precipitation duplicate' }),
    ).not.toBeInTheDocument();
  });
});
