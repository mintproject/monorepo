import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DatasetsBrowse } from '../../pages/datasets/DatasetsBrowse';
import { renderWithProviders } from '../../test/utils/render';

vi.mock('leaflet', () => ({
  default: {
    DomEvent: { stopPropagation: vi.fn() },
    latLngBounds: vi.fn(),
  },
}));
vi.mock('leaflet/dist/leaflet.css', () => ({}));
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dataset-spatial-map">{children}</div>
  ),
  TileLayer: () => null,
  Rectangle: () => null,
  useMapEvents: () => ({ dragging: { disable: vi.fn(), enable: vi.fn() } }),
}));

vi.mock('../../lib/datasets/data-catalog-api', () => ({
  searchDatasets: vi.fn().mockResolvedValue([]),
  fetchDatasetDetail: vi.fn(),
}));
vi.mock('../../lib/datasets/discovery', () => ({
  discoverDatasets: vi.fn().mockResolvedValue({ datasets: [], semanticResults: [] }),
}));

describe('DatasetsBrowse', () => {
  it('renders the first-party discovery surface when no id is in the route', () => {
    renderWithProviders(<DatasetsBrowse />, { initialEntries: ['/datasets/browse'] });
    expect(screen.getByRole('heading', { name: 'Datasets' })).toBeInTheDocument();
    expect(screen.getByLabelText('Search MINT datasets')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Spatial coverage' })).toBeInTheDocument();
    expect(screen.queryByTitle('MINT Data Catalog')).not.toBeInTheDocument();
  });

  it('exposes the two discovery modes', () => {
    renderWithProviders(<DatasetsBrowse />, { initialEntries: ['/datasets/browse'] });
    expect(screen.getByRole('tab', { name: /browse mint-ready datasets/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /find data for a model/i })).toBeInTheDocument();
  });
});
