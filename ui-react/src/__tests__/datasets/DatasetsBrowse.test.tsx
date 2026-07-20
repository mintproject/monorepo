import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DatasetsBrowse } from '../../pages/datasets/DatasetsBrowse';
import { renderWithProviders } from '../../test/utils/render';

// Mock the config so getDataCatalogBrowseUrl returns a predictable value
vi.mock('../../lib/config', () => ({
  getDataCatalogBrowseUrl: () => 'https://data.mint.isi.edu',
}));

describe('DatasetsBrowse', () => {
  it('renders iframe to external catalog when no id in route', () => {
    renderWithProviders(<DatasetsBrowse />, { initialEntries: ['/datasets/browse'] });
    const iframe = screen.getByTitle('MINT Data Catalog');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', 'https://data.mint.isi.edu');
  });

  it('wraps iframe in accessible container', () => {
    renderWithProviders(<DatasetsBrowse />, { initialEntries: ['/datasets/browse'] });
    expect(screen.getByLabelText(/external data catalog/i)).toBeInTheDocument();
  });
});
