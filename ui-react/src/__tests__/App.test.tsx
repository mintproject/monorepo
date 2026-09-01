import { screen, within } from '@testing-library/react';
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
    // Scoped to the sidebar: the landing page links to the same sections, so an
    // unscoped query matches both.
    const nav = within(screen.getByRole('complementary', { name: /main navigation/i }));
    expect(nav.getByRole('link', { name: /home/i })).toBeInTheDocument();
    expect(nav.getByRole('button', { name: /models/i })).toBeInTheDocument();
    expect(nav.getByRole('button', { name: /modeling/i })).toBeInTheDocument();
    expect(nav.getByRole('button', { name: /datasets/i })).toBeInTheDocument();
    expect(nav.getByRole('button', { name: /regions/i })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: /variables/i })).toBeInTheDocument();
  });

  it('renders AppHome at / with welcome text', () => {
    renderApp(['/']);
    expect(screen.getByText(/welcome to mint model catalog/i)).toBeInTheDocument();
  });

  it('renders the models browse page at /models', () => {
    renderApp(['/models']);
    // The browse page renders a model-name filter input...
    expect(screen.getByPlaceholderText(/filter by model name/i)).toBeInTheDocument();
    // ...and the detail placeholder until a config/setup is selected.
    expect(screen.getByText('Select a configuration or setup on the left.')).toBeInTheDocument();
  });

  it('renders NotFoundPage for unknown routes', () => {
    renderApp(['/unknown-route']);
    expect(screen.getByText('Page not found')).toBeInTheDocument();
  });

  // A bare /regions/:id used to fall through to the 404, which is where every
  // click on the old landing-page map ended up.
  it('sends a bare region to its models instead of the 404', () => {
    renderApp(['/regions/ethiopia']);
    expect(screen.queryByText('Page not found')).not.toBeInTheDocument();
  });

  it('keeps the static region routes ahead of the :id route', () => {
    renderApp(['/regions/editor']);
    expect(screen.queryByText('Page not found')).not.toBeInTheDocument();
  });

  // The landing page sends visitors to these four; a card pointing at a 404
  // would be the same defect the old map had.
  it.each(['/models', '/datasets/search', '/regions', '/variables'])(
    'resolves the Explore card route %s',
    (route) => {
      renderApp([route]);
      expect(screen.queryByText('Page not found')).not.toBeInTheDocument();
    },
  );
});
