import { describe, expect, it, vi } from 'vitest';
import type { MockedResponse } from '@apollo/client/testing';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, waitFor } from '@/test/utils/render';
import { GetModelTreeWithRegionsDocument, type Thread } from '@/graphql/generated/modeling';
import { ModelsStep } from '../ModelsStep';

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
});
