import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { DatasetDetail } from '../../pages/datasets/DatasetDetail';
import { renderWithProviders } from '../../test/utils/render';
import type { Dataset } from '../../lib/datasets/types';

vi.mock('../../lib/datasets/data-catalog-api', () => ({
  fetchDatasetDetail: vi.fn(),
}));

import { fetchDatasetDetail } from '../../lib/datasets/data-catalog-api';

const mockDataset: Dataset = {
  id: 'ds-abc123',
  name: 'CHIRPS Rainfall Data',
  region: '',
  variables: [],
  datatype: 'GeoTIFF',
  time_period: null,
  description: 'Climate Hazards Group InfraRed Precipitation with Station data.',
  version: '2.0',
  limitations: 'Tropical/sub-tropical coverage only.',
  source: {
    name: 'UCSB',
    url: 'https://www.chc.ucsb.edu/data/chirps',
    type: 'public',
  },
  is_cached: false,
  resources: [
    {
      id: 'res-1',
      name: 'CHIRPS 2021 Jan',
      url: 'https://example.com/chirps-2021-01.tif',
    },
  ],
  resource_count: 1,
};

describe('DatasetDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    vi.mocked(fetchDatasetDetail).mockReturnValue(new Promise(() => {})); // never resolves
    renderWithProviders(<DatasetDetail datasetId="ds-abc123" />);
    expect(screen.getByText(/loading dataset/i)).toBeInTheDocument();
  });

  it('renders dataset name after load', async () => {
    vi.mocked(fetchDatasetDetail).mockResolvedValue(mockDataset);
    renderWithProviders(<DatasetDetail datasetId="ds-abc123" />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /chirps rainfall data/i })).toBeInTheDocument();
    });
  });

  it('renders dataset metadata', async () => {
    vi.mocked(fetchDatasetDetail).mockResolvedValue(mockDataset);
    renderWithProviders(<DatasetDetail datasetId="ds-abc123" />);

    await waitFor(() => {
      expect(screen.getByText(/climate hazards group/i)).toBeInTheDocument();
    });
  });

  it('renders resources section', async () => {
    vi.mocked(fetchDatasetDetail).mockResolvedValue(mockDataset);
    renderWithProviders(<DatasetDetail datasetId="ds-abc123" />);

    await waitFor(() => {
      expect(screen.getByText('CHIRPS 2021 Jan')).toBeInTheDocument();
    });
  });

  it('shows error state when fetch fails', async () => {
    vi.mocked(fetchDatasetDetail).mockRejectedValue(new Error('Not found'));
    renderWithProviders(<DatasetDetail datasetId="missing" />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Not found');
    });
  });

  it('shows error when no datasetId is provided', async () => {
    renderWithProviders(<DatasetDetail />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/no dataset id provided/i);
    });
  });
});
