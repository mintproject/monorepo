import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DatasetsRegister } from '../../pages/datasets/DatasetsRegister';
import { renderWithProviders } from '../../test/utils/render';

describe('DatasetsRegister', () => {
  it('renders heading', () => {
    renderWithProviders(<DatasetsRegister />);
    expect(screen.getByRole('heading', { name: /register dataset/i })).toBeInTheDocument();
  });

  it('renders in-progress placeholder text', () => {
    renderWithProviders(<DatasetsRegister />);
    expect(screen.getByText(/this page is in progress/i)).toBeInTheDocument();
  });
});
