/**
 * Tests for MintDatasets component.
 *
 * Covers: no models state, dataset display, selection, submit,
 * and read-only (already-selected) view.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/utils/render';
import {
  MintDatasets,
  type ThreadModel,
  type ThreadModelEnsemble,
  type PersistedDataslice,
} from '../MintDatasets';
import type { Thread } from '@/graphql/generated/modeling';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockThread: Thread = {
  __typename: 'thread',
  id: 'mint://thread/t1',
  name: 'Test thread',
  task_id: 'mint://task/task1',
  start_date: '2023-01-01',
  end_date: '2023-12-31',
  region_id: 'Ethiopia',
  driving_variable_id: 'precipitation__daily',
  response_variable_id: 'crop_production',
  // Grant wildcard write access so perm.write=true in tests
  events: [],
  permissions: [{ user_id: '*', read: true, write: true }],
};

const mockModel: ThreadModel = {
  id: 'mint://model/cycles',
  name: 'Cycles',
  url: '/Ethiopia/models/explore/cycles',
  input_files: [
    {
      id: 'mint://input/weather',
      name: 'Weather data',
      variables: ['precipitation__daily', 'temperature__max'],
      isOptional: false,
    },
    {
      id: 'mint://input/soil',
      name: 'Soil data',
      variables: ['soil_texture'],
      isOptional: true,
      value: 'pre-selected-soil.csv',
    },
  ],
};

const mockModels: Record<string, ThreadModel> = {
  [mockModel.id]: mockModel,
};

const mockEnsembles: Record<string, ThreadModelEnsemble> = {
  [mockModel.id]: {
    id: 'ens-uuid-1',
    bindings: {},
  },
};

const mockThreadData: Record<string, PersistedDataslice> = {};

// Data Catalog REST mock response
const mockFindDatasetsResponse = {
  result: 'success',
  datasets: [
    {
      dataset_id: 'ds-001',
      dataset_name: 'Ethiopia Precipitation 2023',
      dataset_metadata: {
        dataset_description: 'Daily precipitation data',
        version: '1.0',
        limitations: '',
        source: 'CHIRPS',
        source_url: 'https://chirps.ucsb.edu',
        source_type: 'remote',
        category_tags: ['climate'],
        resource_count: 12,
        datatype: 'NetCDF',
        temporal_coverage: {
          start_time: '2023-01-01',
          end_time: '2023-12-31',
        },
      },
    },
    {
      dataset_id: 'ds-002',
      dataset_name: 'Ethiopia NDVI 2023',
      dataset_metadata: {
        dataset_description: 'NDVI data',
        version: '1.0',
        limitations: '',
        source: 'MODIS',
        source_url: 'https://modis.gsfc.nasa.gov',
        source_type: 'remote',
        category_tags: ['vegetation'],
        resource_count: 4,
        datatype: 'GeoTIFF',
        temporal_coverage: {
          start_time: '2023-01-01',
          end_time: '2023-12-31',
        },
      },
    },
  ],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MintDatasets', () => {
  beforeEach(() => {
    // Mock the data catalog /datasets/find endpoint
    server.use(
      http.post('*/datasets/find', () => {
        return HttpResponse.json(mockFindDatasetsResponse);
      }),
    );
  });

  it('shows a message when no models are selected', () => {
    renderWithProviders(
      <MintDatasets
        thread={mockThread}
        models={{}}
        modelEnsembles={{}}
        threadData={{}}
        onContinue={vi.fn()}
      />,
    );
    expect(screen.getByTestId('mint-datasets')).toBeInTheDocument();
    expect(screen.getByText(/Please select model\(s\) first/i)).toBeInTheDocument();
  });

  it('renders model sections with input file rows', async () => {
    renderWithProviders(
      <MintDatasets
        thread={mockThread}
        models={mockModels}
        modelEnsembles={mockEnsembles}
        threadData={mockThreadData}
        onContinue={vi.fn()}
      />,
    );

    // Model name visible
    expect(screen.getByText('Cycles')).toBeInTheDocument();

    // Pre-selected input visible
    expect(screen.getByText('Soil data')).toBeInTheDocument();

    // Required input visible
    expect(screen.getByText('Weather data')).toBeInTheDocument();
  });

  it('loads and displays datasets from the data catalog', async () => {
    renderWithProviders(
      <MintDatasets
        thread={mockThread}
        models={mockModels}
        modelEnsembles={mockEnsembles}
        threadData={mockThreadData}
        onContinue={vi.fn()}
      />,
    );

    // Wait for datasets to load
    await waitFor(() => {
      expect(screen.getByText('Ethiopia Precipitation 2023')).toBeInTheDocument();
    });
  });

  it('renders Select & Continue button', async () => {
    renderWithProviders(
      <MintDatasets
        thread={mockThread}
        models={mockModels}
        modelEnsembles={mockEnsembles}
        threadData={mockThreadData}
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getByTestId('datasets-submit')).toBeInTheDocument();
  });

  it('shows pre-selected fixed inputs in a table', () => {
    renderWithProviders(
      <MintDatasets
        thread={mockThread}
        models={mockModels}
        modelEnsembles={mockEnsembles}
        threadData={mockThreadData}
        onContinue={vi.fn()}
      />,
    );

    // Pre-selected Datasets section header
    expect(screen.getByText('Pre-selected Datasets')).toBeInTheDocument();

    // The soil input has a fixed value (pre-selected)
    expect(screen.getByText('Soil data')).toBeInTheDocument();
  });

  it('renders the datasets description paragraph', () => {
    renderWithProviders(
      <MintDatasets
        thread={mockThread}
        models={mockModels}
        modelEnsembles={mockEnsembles}
        threadData={mockThreadData}
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getByText(/selecting datasets for each of the models/i)).toBeInTheDocument();
  });

  it('shows existing binding view mode when bindings are present and no edit mode', () => {
    const sliceId = 'slice-001';
    const withBinding: Record<string, ThreadModelEnsemble> = {
      [mockModel.id]: {
        id: 'ens-uuid-1',
        bindings: {
          'mint://input/weather': [sliceId],
        },
      },
    };
    const withData: Record<string, PersistedDataslice> = {
      [sliceId]: {
        id: sliceId,
        name: 'Dataset slice 1',
        dataset: { id: 'ds-001', name: 'Ethiopia Precipitation 2023' },
        total_resources: 12,
        selected_resources: 12,
      },
    };

    renderWithProviders(
      <MintDatasets
        thread={mockThread}
        models={mockModels}
        modelEnsembles={withBinding}
        threadData={withData}
        onContinue={vi.fn()}
      />,
    );

    // View mode: shows the dataset name
    expect(screen.getByText('Ethiopia Precipitation 2023')).toBeInTheDocument();

    // In view mode with bindings, shows Continue button not Submit
    expect(screen.getByTestId('datasets-continue')).toBeInTheDocument();
  });

  it('calls onContinue when Continue is clicked in view mode', async () => {
    const onContinue = vi.fn();
    const sliceId = 'slice-001';
    const withBinding: Record<string, ThreadModelEnsemble> = {
      [mockModel.id]: {
        id: 'ens-uuid-1',
        bindings: { 'mint://input/weather': [sliceId] },
      },
    };
    const withData: Record<string, PersistedDataslice> = {
      [sliceId]: {
        id: sliceId,
        name: 'Dataset slice 1',
        dataset: { id: 'ds-001', name: 'Ethiopia Precipitation 2023' },
      },
    };

    renderWithProviders(
      <MintDatasets
        thread={mockThread}
        models={mockModels}
        modelEnsembles={withBinding}
        threadData={withData}
        onContinue={onContinue}
      />,
    );

    fireEvent.click(screen.getByTestId('datasets-continue'));
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
