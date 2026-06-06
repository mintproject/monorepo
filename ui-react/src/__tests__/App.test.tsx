import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from '../App';
import { renderWithProviders } from '../test/utils/render';

function renderApp(initialEntries: string[] = ['/']) {
  return renderWithProviders(<App />, { initialEntries });
}

describe('App', () => {
  it('renders the header with app title', () => {
    renderApp();
    expect(screen.getByText('MINT Model Catalog')).toBeInTheDocument();
  });

  it('renders the sidebar navigation with all platform sections', () => {
    renderApp();
    expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /models/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /modeling/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /datasets/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /regions/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /variables/i })).toBeInTheDocument();
  });

  it('renders AppHome at / with welcome text', () => {
    renderApp(['/']);
    expect(screen.getByText(/welcome to mint model catalog/i)).toBeInTheDocument();
  });

  it('renders ModelsPage at /models', () => {
    renderApp(['/models']);
    // ModelsPage shows the selection-detail placeholder until a tree node is picked.
    expect(
      screen.getByText('Select a model, version, or configuration on the left.'),
    ).toBeInTheDocument();
  });

  it('renders NotFoundPage for unknown routes', () => {
    renderApp(['/unknown-route']);
    expect(screen.getByText('Page not found')).toBeInTheDocument();
  });
});
