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

// CKAN package_search mock response.
//
// `mint_standard_variables` on each resource is what the lookup matches on; both
// packages carry the weather input's variables, so both are hits. A package
// whose resources carry none is not returned, however well its prose reads.
const mockFindDatasetsResponse = {
  success: true,
  result: {
    count: 2,
    results: [
      {
        id: 'e1f2a3b4-0000-0000-0000-000000000001',
        name: 'ds-001',
        title: 'Ethiopia Precipitation 2023',
        notes: 'Daily precipitation data',
        version: '1.0',
        url: 'https://chirps.ucsb.edu',
        license_title: '',
        num_resources: 12,
        organization: { name: 'chirps', title: 'CHIRPS' },
        tags: [{ name: 'climate' }],
        temporal_coverage_start: '2023-01-01',
        temporal_coverage_end: '2023-12-31',
        resources: [
          {
            id: 'r-1',
            name: 'precip-01',
            url: 'https://chirps.ucsb.edu/1',
            format: 'NetCDF',
            mint_standard_variables: 'precipitation__daily',
          },
        ],
      },
      {
        id: 'e1f2a3b4-0000-0000-0000-000000000002',
        name: 'ds-002',
        title: 'Ethiopia NDVI 2023',
        notes: 'NDVI data',
        version: '1.0',
        url: 'https://modis.gsfc.nasa.gov',
        license_title: '',
        num_resources: 4,
        organization: { name: 'modis', title: 'MODIS' },
        tags: [{ name: 'vegetation' }],
        temporal_coverage_start: '2023-01-01',
        temporal_coverage_end: '2023-12-31',
        resources: [
          {
            id: 'r-2',
            name: 'ndvi-01',
            url: 'https://modis.gsfc.nasa.gov/1',
            format: 'GeoTIFF',
            mint_standard_variables: 'temperature__max,precipitation__daily',
          },
        ],
      },
    ],
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MintDatasets', () => {
  beforeEach(() => {
    // Mock the CKAN package_search endpoint
    server.use(
      http.get('*/api/3/action/package_search', () => {
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
