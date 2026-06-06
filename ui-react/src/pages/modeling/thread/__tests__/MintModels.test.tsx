/**
 * Tests for MintModels — model selection step in the modeling workflow.
 */
import { describe, expect, it, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils/render';
import { MintModels } from '../MintModels';
import type { Thread, ThreadModel } from '@/graphql/generated/modeling';
import { GetModelTreeWithRegionsDocument } from '@/graphql/generated/modeling';

const baseThread: Thread = {
  __typename: 'thread',
  id: 'mint://thread/t1',
  name: 'Test thread',
  task_id: 'mint://task/task1',
  start_date: '2023-01-01',
  end_date: '2023-12-31',
  region_id: 'Ethiopia',
  driving_variable_id: null,
  response_variable_id: null,
  events: [
    {
      __typename: 'thread_provenance',
      event: 'CREATE' as const,
      userid: 'testuser',
      timestamp: '2023-01-01T00:00:00Z',
      notes: null,
    },
  ],
  permissions: [],
  thread_models: [],
};

const mockModelTreeData = {
  modelcatalog_software: [
    {
      id: 'https://w3id.org/okn/i/mint/cycles',
      label: 'Cycles',
      versions: [
        {
          id: 'https://w3id.org/okn/i/mint/cycles-v0.9.3',
          label: 'Cycles v0.9.3',
          configurations: [
            {
              id: 'https://w3id.org/okn/i/mint/cycles-v0.9.3-cfg',
              label: 'Cycles Crop',
              regions: [
                {
                  region: {
                    id: 'Ethiopia',
                    label: 'Ethiopia',
                  },
                },
              ],
              child_configurations: [
                {
                  id: 'https://w3id.org/okn/i/mint/cycles-v0.9.3-cfg-setup',
                  label: 'Cycles Crop (Ethiopia)',
                  description: 'Calibrated for Ethiopia',
                  regions: [
                    {
                      region: {
                        id: 'Ethiopia',
                        label: 'Ethiopia',
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const modelTreeMock = {
  request: {
    query: GetModelTreeWithRegionsDocument,
    variables: {},
  },
  result: {
    data: mockModelTreeData,
  },
};

describe('MintModels', () => {
  it('shows edit mode when thread has no models', () => {
    renderWithProviders(<MintModels thread={baseThread} />, {
      apolloMocks: [modelTreeMock],
    });
    expect(screen.getByTestId('models-edit-mode')).toBeInTheDocument();
  });

  it('shows view mode when thread already has models', () => {
    const threadWithModels: Thread = {
      ...baseThread,
      thread_models: [
        {
          __typename: 'thread_model',
          id: 'tm-1',
          thread_id: 'mint://thread/t1',
          model_id: null,
          modelcatalog_configuration_id: 'https://w3id.org/okn/i/mint/cycles-v0.9.3-cfg-setup',
        } as ThreadModel,
      ],
    };
    renderWithProviders(<MintModels thread={threadWithModels} />, {
      apolloMocks: [modelTreeMock],
    });
    expect(screen.getByTestId('models-view-mode')).toBeInTheDocument();
  });

  it('renders search input in edit mode', () => {
    renderWithProviders(<MintModels thread={baseThread} />, {
      apolloMocks: [modelTreeMock],
    });
    expect(screen.getByTestId('model-search-input')).toBeInTheDocument();
  });

  it('renders notes textarea in edit mode', () => {
    renderWithProviders(<MintModels thread={baseThread} />, {
      apolloMocks: [modelTreeMock],
    });
    expect(screen.getByTestId('model-notes')).toBeInTheDocument();
  });

  it('renders Select & Continue button disabled when no models checked', () => {
    renderWithProviders(<MintModels thread={baseThread} />, {
      apolloMocks: [modelTreeMock],
    });
    const btn = screen.getByTestId('select-continue-btn');
    expect(btn).toBeDisabled();
  });

  it('compare button is disabled when fewer than 2 models selected', () => {
    renderWithProviders(<MintModels thread={baseThread} />, {
      apolloMocks: [modelTreeMock],
    });
    expect(screen.getByTestId('compare-btn')).toBeDisabled();
  });

  it('displays models table after data loads', async () => {
    renderWithProviders(<MintModels thread={baseThread} />, {
      apolloMocks: [modelTreeMock],
    });
    await waitFor(() => {
      expect(screen.getByTestId('models-table')).toBeInTheDocument();
    });
  });

  it('shows empty state when search finds no matches', async () => {
    renderWithProviders(<MintModels thread={baseThread} />, {
      apolloMocks: [modelTreeMock],
    });
    const input = screen.getByTestId('model-search-input');
    fireEvent.change(input, { target: { value: 'xyzzy-no-match-12345' } });
    await waitFor(() => {
      expect(screen.getByTestId('no-models-row')).toBeInTheDocument();
    });
  });

  it('calls onContinue when Continue clicked in view mode', () => {
    const onContinue = vi.fn();
    const threadWithModels: Thread = {
      ...baseThread,
      thread_models: [
        {
          __typename: 'thread_model',
          id: 'tm-1',
          thread_id: 'mint://thread/t1',
          model_id: null,
          modelcatalog_configuration_id: 'https://w3id.org/okn/i/mint/cycles-v0.9.3-cfg-setup',
        } as ThreadModel,
      ],
    };
    renderWithProviders(<MintModels thread={threadWithModels} onContinue={onContinue} />, {
      apolloMocks: [modelTreeMock],
    });
    fireEvent.click(screen.getByTestId('continue-btn'));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('edit button transitions from view to edit mode', () => {
    const threadWithModels: Thread = {
      ...baseThread,
      thread_models: [
        {
          __typename: 'thread_model',
          id: 'tm-1',
          thread_id: 'mint://thread/t1',
          model_id: null,
          modelcatalog_configuration_id: 'https://w3id.org/okn/i/mint/cycles-v0.9.3-cfg-setup',
        } as ThreadModel,
      ],
    };
    renderWithProviders(<MintModels thread={threadWithModels} />, {
      apolloMocks: [modelTreeMock],
    });
    expect(screen.getByTestId('models-view-mode')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('edit-models-btn'));
    expect(screen.getByTestId('models-edit-mode')).toBeInTheDocument();
  });

  it('cancel button returns from edit to view mode', () => {
    const threadWithModels: Thread = {
      ...baseThread,
      thread_models: [
        {
          __typename: 'thread_model',
          id: 'tm-1',
          thread_id: 'mint://thread/t1',
          model_id: null,
          modelcatalog_configuration_id: 'https://w3id.org/okn/i/mint/cycles-v0.9.3-cfg-setup',
        } as ThreadModel,
      ],
    };
    renderWithProviders(<MintModels thread={threadWithModels} />, {
      apolloMocks: [modelTreeMock],
    });
    fireEvent.click(screen.getByTestId('edit-models-btn'));
    expect(screen.getByTestId('models-edit-mode')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cancel-btn'));
    expect(screen.getByTestId('models-view-mode')).toBeInTheDocument();
  });
});
