import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { DatasetsSearch } from '../../pages/datasets/DatasetsSearch';
import { renderWithProviders } from '../../test/utils/render';
import type { Dataset } from '../../lib/datasets/types';

// Mock the API module
vi.mock('../../lib/datasets/data-catalog-api', () => ({
  searchDatasets: vi.fn(),
}));

import { searchDatasets } from '../../lib/datasets/data-catalog-api';

const mockDatasets: Dataset[] = [
  {
    id: 'ds-1',
    name: 'GLDAS Dataset',
    region: '',
    variables: ['precipitation'],
    datatype: 'NetCDF',
    time_period: null,
    description: 'Global Land Data Assimilation System dataset',
    version: '2.1',
    limitations: 'None',
    source: { name: 'NASA', url: 'https://nasa.gov', type: 'public' },
    is_cached: true,
    resources: [],
    resource_count: 5,
  },
];

describe('DatasetsSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the search form', () => {
    renderWithProviders(<DatasetsSearch />);
    expect(screen.getByRole('heading', { name: /search datasets/i })).toBeInTheDocument();
    expect(screen.getByRole('form', { hidden: true })).toBeInTheDocument();
    expect(screen.getByLabelText(/search datasets/i)).toBeInTheDocument();
  });

  it('renders search type selector', () => {
    renderWithProviders(<DatasetsSearch />);
    expect(screen.getByLabelText(/search on/i)).toBeInTheDocument();
  });

  it('renders Search button', () => {
    renderWithProviders(<DatasetsSearch />);
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  it('calls searchDatasets on form submit and displays results', async () => {
    vi.mocked(searchDatasets).mockResolvedValue(mockDatasets);
    const user = userEvent.setup();

    renderWithProviders(<DatasetsSearch />);

    const input = screen.getByLabelText(/search datasets/i);
    await user.type(input, 'GLDAS');
    await user.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByText('GLDAS Dataset')).toBeInTheDocument();
    });

    expect(searchDatasets).toHaveBeenCalledWith({ name: '*GLDAS*' });
  });

  it('shows error message when search fails', async () => {
    vi.mocked(searchDatasets).mockRejectedValue(new Error('Network error'));
    const user = userEvent.setup();

    renderWithProviders(<DatasetsSearch />);

    const input = screen.getByLabelText(/search datasets/i);
    await user.type(input, 'test');
    await user.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error');
    });
  });

  it('shows empty state when no results returned', async () => {
    vi.mocked(searchDatasets).mockResolvedValue([]);
    const user = userEvent.setup();

    renderWithProviders(<DatasetsSearch />);

    const input = screen.getByLabelText(/search datasets/i);
    await user.type(input, 'xyznotfound');
    await user.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(screen.getByText(/no datasets found/i)).toBeInTheDocument();
    });
  });
});
