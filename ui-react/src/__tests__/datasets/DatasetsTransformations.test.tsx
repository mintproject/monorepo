import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { DatasetsTransformations } from '../../pages/datasets/DatasetsTransformations';
import { renderWithProviders } from '../../test/utils/render';
import type { DataTransformation } from '../../lib/datasets/types';

vi.mock('../../lib/datasets/model-catalog-api', () => ({
  fetchDataTransformations: vi.fn(),
  fetchDataTransformation: vi.fn(),
}));

import {
  fetchDataTransformations,
  fetchDataTransformation,
} from '../../lib/datasets/model-catalog-api';

const mockTransformations: DataTransformation[] = [
  {
    id: 'https://w3id.org/okn/i/mint/topoflow_transform',
    label: 'TopoFlow Transformation',
    description: 'Converts DEM data for TopoFlow model.',
    type: 'https://w3id.org/okn/o/sd#DataTransformation',
  },
  {
    id: 'https://w3id.org/okn/i/mint/pihm_transform',
    label: 'PIHM Transformation',
    description: 'Converts spatial data for PIHM model.',
    type: 'https://w3id.org/okn/o/sd#DataTransformation',
  },
];

const mockDetail: DataTransformation = {
  id: 'https://w3id.org/okn/i/mint/topoflow_transform',
  label: 'TopoFlow Transformation',
  description: 'Converts DEM data for TopoFlow model.',
  type: 'https://w3id.org/okn/o/sd#DataTransformation',
};

describe('DatasetsTransformations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page heading', () => {
    vi.mocked(fetchDataTransformations).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<DatasetsTransformations />);
    expect(screen.getByRole('heading', { name: /data transformations/i })).toBeInTheDocument();
  });

  it('shows loading state while fetching list', () => {
    vi.mocked(fetchDataTransformations).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<DatasetsTransformations />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders list of transformations after load', async () => {
    vi.mocked(fetchDataTransformations).mockResolvedValue(mockTransformations);
    renderWithProviders(<DatasetsTransformations />);

    await waitFor(() => {
      expect(screen.getByText('TopoFlow Transformation')).toBeInTheDocument();
      expect(screen.getByText('PIHM Transformation')).toBeInTheDocument();
    });
  });

  it('shows empty state when no transformations exist', async () => {
    vi.mocked(fetchDataTransformations).mockResolvedValue([]);
    renderWithProviders(<DatasetsTransformations />);

    await waitFor(() => {
      expect(screen.getByText(/no data transformations found/i)).toBeInTheDocument();
    });
  });

  it('shows error when list fetch fails', async () => {
    vi.mocked(fetchDataTransformations).mockRejectedValue(new Error('Server error'));
    renderWithProviders(<DatasetsTransformations />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Server error');
    });
  });

  it('loads detail on transformation click', async () => {
    vi.mocked(fetchDataTransformations).mockResolvedValue(mockTransformations);
    vi.mocked(fetchDataTransformation).mockResolvedValue(mockDetail);
    const user = userEvent.setup();

    renderWithProviders(<DatasetsTransformations />);

    await waitFor(() => {
      expect(screen.getByText('TopoFlow Transformation')).toBeInTheDocument();
    });

    await user.click(screen.getByText('TopoFlow Transformation'));

    await waitFor(() => {
      expect(screen.getByText('Converts DEM data for TopoFlow model.')).toBeInTheDocument();
    });

    expect(fetchDataTransformation).toHaveBeenCalledWith(mockTransformations[0].id);
  });
});
