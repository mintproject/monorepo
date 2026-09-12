import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockedResponse } from '@apollo/client/testing';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, waitFor } from '@/test/utils/render';
import {
  GetModelTreeWithRegionsDocument,
  SetThreadModelsDocument,
  type Thread,
} from '@/graphql/generated/modeling';
import { ModelsStep } from '../ModelsStep';

const toastSpy = vi.fn();
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: toastSpy }),
}));

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

function cfg(id: string, label: string, outVarId: string, outVarLabel: string) {
  return {
    id,
    label,
    regions: [],
    inputs: [
      {
        is_optional: false,
        input: {
          id: `${id}-in`,
          label: 'precipitation',
          presentations: [
            {
              presentation: {
                id: `${id}-vp`,
                standard_variable: { id: 'sv-precip', label: 'precipitation' },
              },
            },
          ],
        },
      },
    ],
    outputs: [
      {
        output: {
          id: `${id}-out`,
          label: outVarLabel,
          presentations: [
            {
              presentation: {
                id: `${id}-ovp`,
                standard_variable: { id: outVarId, label: outVarLabel },
              },
            },
          ],
        },
      },
    ],
    child_configurations: [],
  };
}

const treeMock: MockedResponse = {
  request: { query: GetModelTreeWithRegionsDocument },
  result: {
    data: {
      modelcatalog_software: [
        {
          id: 'sw1',
          label: 'PIHM',
          versions: [
            {
              id: 'v1',
              label: 'v4',
              configurations: [
                cfg('cfgA', 'PIHM Flood A', 'sv-flood', 'flood extent'),
                cfg('cfgB', 'Crop Model B', 'sv-crop', 'crop production'),
              ],
            },
          ],
        },
      ],
    },
  },
};

describe('ModelsStep', () => {
  it('shows "all models" banner and produces chip when no indicator is set', async () => {
    renderWithProviders(
      <ModelsStep
        thread={makeThread()}
        onUpdated={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
      { apolloMocks: [treeMock] },
    );
    expect(await screen.findByText('PIHM Flood A')).toBeInTheDocument();
    expect(screen.getByText('produces: flood extent')).toBeInTheDocument();
    expect(screen.getByTestId('filtered-by-banner')).toHaveTextContent(/all/i);
  });

  it('filters to models producing the indicator and shows the count', async () => {
    renderWithProviders(
      <ModelsStep
        thread={makeThread({ response_variable_id: 'sv-flood' })}
        onUpdated={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
      { apolloMocks: [treeMock] },
    );
    expect(await screen.findByText('PIHM Flood A')).toBeInTheDocument();
    expect(screen.queryByText('Crop Model B')).not.toBeInTheDocument();
    expect(screen.getByTestId('filtered-by-banner')).toHaveTextContent(/1 of 2/i);
  });

  // ── An indicator that reaches nothing (monorepo#103) ──────────────────────
  //
  // The Variables step now offers producible indicators only, so an empty list
  // means a STORED value: a thread saved before that rule, or one whose model
  // lost its output. A bare "No models found." gives the user no way to act.

  it('names the indicator that empties the list, instead of "No models found."', async () => {
    renderWithProviders(
      <ModelsStep
        thread={makeThread({
          response_variable_id: 'https://w3id.org/okn/i/mint/DEAD_MOISTURE',
          response_variable: {
            __typename: 'modelcatalog_standard_variable',
            id: 'https://w3id.org/okn/i/mint/DEAD_MOISTURE',
            label: '100hr_dead_moisture',
          },
        })}
        onUpdated={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
      { apolloMocks: [treeMock] },
    );
    expect(await screen.findByText(/no model produces/i)).toHaveTextContent('100hr_dead_moisture');
    expect(screen.queryByText('No models found.')).not.toBeInTheDocument();
  });

  it('prints the indicator label, never its URI', async () => {
    renderWithProviders(
      <ModelsStep
        thread={makeThread({
          response_variable_id: 'https://w3id.org/okn/i/mint/DEAD_MOISTURE',
          response_variable: {
            __typename: 'modelcatalog_standard_variable',
            id: 'https://w3id.org/okn/i/mint/DEAD_MOISTURE',
            label: '100hr_dead_moisture',
          },
        })}
        onUpdated={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
      { apolloMocks: [treeMock] },
    );
    await screen.findByText(/no model produces/i);
    expect(screen.queryByText(/w3id\.org/)).not.toBeInTheDocument();
  });

  it('offers a way back to the Variables step when the indicator reaches nothing', async () => {
    const onEditIndicator = vi.fn();
    renderWithProviders(
      <ModelsStep
        thread={makeThread({ response_variable_id: 'sv-nothing' })}
        onUpdated={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
        onEditIndicator={onEditIndicator}
      />,
      { apolloMocks: [treeMock] },
    );
    await userEvent.click(
      await screen.findByRole('button', { name: /choose a different indicator/i }),
    );
    expect(onEditIndicator).toHaveBeenCalled();
  });

  // A search that matches nothing is a different fault and keeps its own words.
  it('still reports an empty search separately from an empty indicator', async () => {
    renderWithProviders(
      <ModelsStep
        thread={makeThread({ response_variable_id: 'sv-flood' })}
        onUpdated={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
      { apolloMocks: [treeMock] },
    );
    await screen.findByText('PIHM Flood A');
    await userEvent.type(screen.getByPlaceholderText(/filter models/i), 'zzzz');
    expect(await screen.findByText('No models match your search.')).toBeInTheDocument();
  });

  it('gates Continue on >=1 selected model', async () => {
    renderWithProviders(
      <ModelsStep
        thread={makeThread()}
        onUpdated={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
      { apolloMocks: [treeMock] },
    );
    await screen.findByText('PIHM Flood A');
    expect(screen.getByTestId('step-continue')).toBeDisabled();
    await userEvent.click(screen.getByLabelText(/select PIHM Flood A/i));
    await waitFor(() => expect(screen.getByTestId('step-continue')).toBeEnabled());
  });

  // ── Saving the selection (monorepo#107) ────────────────────────────────────
  //
  // The four tables that reference thread_model.id are ON DELETE RESTRICT, so
  // the step must never delete a row it means to keep. These assert the
  // outgoing mutation variables, not the component's internal state.

  describe('saving', () => {
    beforeEach(() => toastSpy.mockClear());

    function threadWithModels() {
      return makeThread({
        thread_models: [
          {
            __typename: 'thread_model',
            id: 'tm-a',
            thread_id: 't1',
            modelcatalog_configuration_id: 'cfgA',
          },
          {
            __typename: 'thread_model',
            id: 'tm-b',
            thread_id: 't1',
            modelcatalog_configuration_id: 'cfgB',
          },
        ],
      });
    }

    function saveMock(sent: Record<string, unknown>[]): MockedResponse {
      return {
        request: { query: SetThreadModelsDocument },
        maxUsageCount: Number.MAX_SAFE_INTEGER,
        variableMatcher: (vars) => {
          sent.push(vars);
          return true;
        },
        result: {
          data: {
            delete_thread_model_execution_summary: { affected_rows: 0 },
            delete_thread_model_execution: { affected_rows: 0 },
            delete_thread_model_io: { affected_rows: 0 },
            delete_thread_model_parameter: { affected_rows: 0 },
            delete_thread_model: { affected_rows: 1 },
            insert_thread_model: { returning: [] },
            insert_thread_provenance_one: { thread_id: 't1' },
          },
        },
      };
    }

    it('writes nothing when the selection is unchanged', async () => {
      const sent: Record<string, unknown>[] = [];
      const onContinue = vi.fn();
      renderWithProviders(
        <ModelsStep
          thread={threadWithModels()}
          onUpdated={vi.fn()}
          onContinue={onContinue}
          onBack={vi.fn()}
        />,
        { apolloMocks: [treeMock, saveMock(sent)] },
      );
      await screen.findByText('PIHM Flood A');
      await userEvent.click(screen.getByTestId('step-continue'));

      await waitFor(() => expect(onContinue).toHaveBeenCalled());
      expect(sent).toEqual([]);
    });

    it('deletes only the deselected row and re-inserts nothing', async () => {
      const sent: Record<string, unknown>[] = [];
      renderWithProviders(
        <ModelsStep
          thread={threadWithModels()}
          onUpdated={vi.fn()}
          onContinue={vi.fn()}
          onBack={vi.fn()}
        />,
        { apolloMocks: [treeMock, saveMock(sent)] },
      );
      await screen.findByText('Crop Model B');
      await userEvent.click(screen.getByLabelText(/select Crop Model B/i));
      await userEvent.click(screen.getByTestId('step-continue'));

      await waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0]).toMatchObject({ removedIds: ['tm-b'], models: [] });
    });

    it('inserts only the newly selected row and deletes nothing', async () => {
      const sent: Record<string, unknown>[] = [];
      const thread = makeThread({
        thread_models: [
          {
            __typename: 'thread_model',
            id: 'tm-a',
            thread_id: 't1',
            modelcatalog_configuration_id: 'cfgA',
          },
        ],
      });
      renderWithProviders(
        <ModelsStep thread={thread} onUpdated={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />,
        { apolloMocks: [treeMock, saveMock(sent)] },
      );
      await screen.findByText('Crop Model B');
      await userEvent.click(screen.getByLabelText(/select Crop Model B/i));
      await userEvent.click(screen.getByTestId('step-continue'));

      await waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0]).toMatchObject({
        removedIds: [],
        models: [{ thread_id: 't1', modelcatalog_configuration_id: 'cfgB' }],
      });
    });

    it('reports a rejected save instead of failing silently', async () => {
      const onContinue = vi.fn();
      const failing: MockedResponse = {
        request: { query: SetThreadModelsDocument },
        variableMatcher: () => true,
        error: new Error('Foreign key violation'),
      };
      renderWithProviders(
        <ModelsStep
          thread={threadWithModels()}
          onUpdated={vi.fn()}
          onContinue={onContinue}
          onBack={vi.fn()}
        />,
        { apolloMocks: [treeMock, failing] },
      );
      await screen.findByText('Crop Model B');
      await userEvent.click(screen.getByLabelText(/select Crop Model B/i));
      await userEvent.click(screen.getByTestId('step-continue'));

      await waitFor(() =>
        expect(toastSpy).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Save failed', variant: 'destructive' }),
        ),
      );
      expect(onContinue).not.toHaveBeenCalled();
    });
  });
});
