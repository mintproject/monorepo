/**
 * Tests for ConfigurePage — two-column layout.
 */
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GetModelTreeDocument } from '@/graphql/generated/graphql';
import { renderWithProviders } from '@/test/utils/render';
import { ConfigurePage } from '@/pages/ConfigurePage';

const emptyTreeMock = {
  request: { query: GetModelTreeDocument },
  result: { data: { modelcatalog_software: [] } },
};

describe('ConfigurePage', () => {
  it('renders the models header and tree sidebar', async () => {
    renderWithProviders(<ConfigurePage />, {
      apolloMocks: [emptyTreeMock],
    });

    await waitFor(() => {
      expect(screen.getByText('Models')).toBeInTheDocument();
    });
  });

  it('shows empty state when no configuration is selected', async () => {
    renderWithProviders(<ConfigurePage />, {
      apolloMocks: [emptyTreeMock],
      initialEntries: ['/models/configure'],
    });

    await waitFor(() => {
      expect(screen.getByText(/no configuration selected/i)).toBeInTheDocument();
    });
  });
});
