import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LIST_TOP_REGIONS } from '@/graphql/queries/regions';
import { renderWithProviders } from '@/test/utils/render';
import { GuidedModelSetup } from '../GuidedModelSetup';

const { recommendProblemStatement, findDatasetsByVariables } = vi.hoisted(() => ({
  recommendProblemStatement: vi.fn(),
  findDatasetsByVariables: vi.fn(),
}));

vi.mock('@/lib/modeling/problemStatementRecommendations', () => ({
  recommendProblemStatement,
}));
vi.mock('@/lib/data-catalog', () => ({
  findDatasetsByVariables,
}));
vi.mock('@/graphql/generated/modeling', () => ({
  generateModelingId: vi.fn(() => 'ps-1'),
  useInsertProblemStatementMutation: vi.fn(() => [vi.fn()]),
  useInsertProblemStatementProvenanceMutation: vi.fn(() => [vi.fn()]),
  useInsertTaskMutation: vi.fn(() => [vi.fn()]),
  useInsertTaskProvenanceMutation: vi.fn(() => [vi.fn()]),
  useInsertThreadMutation: vi.fn(() => [vi.fn()]),
  useInsertThreadProvenanceMutation: vi.fn(() => [vi.fn()]),
  useListProblemStatementsQuery: vi.fn(() => ({ data: { problem_statement: [] }, loading: false })),
  useSetThreadModelsMutation: vi.fn(() => [vi.fn()]),
  useUpdateThreadMutation: vi.fn(() => [vi.fn()]),
}));
vi.mock('@/lib/modeling/provisionTask', () => ({
  provisionTask: vi.fn().mockResolvedValue({ taskId: 'task-1', threadId: 'thread-1' }),
}));

describe('GuidedModelSetup', () => {
  beforeEach(() => {
    recommendProblemStatement.mockResolvedValue({
      status: 'ok',
      results: {
        svo: [
          {
            id: 'sv-head',
            label: 'Groundwater hydraulic head',
            description: 'Water level',
            evidence: [{ source: 'model_configuration', label: 'MODFLOW', relation: 'input' }],
          },
        ],
        model_configuration: [
          {
            id: 'model-2',
            label: 'MODFLOW configuration',
            description: 'Groundwater model',
            standard_variables: [
              { id: 'sv-head', label: 'Groundwater hydraulic head', role: 'input' },
            ],
            evidence: [],
          },
        ],
      },
    });
    findDatasetsByVariables.mockResolvedValue([]);
  });

  it('asks framing questions before requesting recommendations', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GuidedModelSetup />, {
      initialEntries: ['/modeling/problem-statements/start'],
      apolloMocks: [
        {
          request: { query: LIST_TOP_REGIONS },
          result: {
            data: {
              region: [{ id: 'texas', name: 'Texas', model_catalog_uri: null, geometries: [] }],
            },
          },
        },
      ],
    });

    expect(screen.getByRole('button', { name: 'Find recommendations' })).toBeDisabled();
    await user.type(
      screen.getByLabelText(/what are you trying/i),
      'Understand groundwater availability',
    );
    await user.click(screen.getByRole('combobox', { name: 'Region' }));
    await user.click(screen.getByRole('option', { name: 'Texas' }));

    await user.click(screen.getByRole('button', { name: 'Find recommendations' }));

    await waitFor(() => expect(recommendProblemStatement).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Groundwater hydraulic head')).toBeInTheDocument();
    expect(screen.getByText('MODFLOW configuration')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm and start setup/i })).toBeDisabled();
  });

  it('preserves and displays initiating model and dataset context', () => {
    renderWithProviders(<GuidedModelSetup />, {
      initialEntries: ['/modeling/problem-statements/start?modelId=model-1&datasetId=dataset-1'],
      apolloMocks: [
        {
          request: { query: LIST_TOP_REGIONS },
          result: { data: { region: [] } },
        },
      ],
    });

    expect(screen.getByRole('button', { name: /model: model-1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dataset: dataset-1/i })).toBeInTheDocument();
  });
});
