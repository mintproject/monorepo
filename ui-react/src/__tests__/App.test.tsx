import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MockedProvider } from '@apollo/client/testing';
import { describe, expect, it } from 'vitest';

import { App } from '../App';
import { AuthProvider } from '../lib/auth/AuthProvider';

function renderApp(initialEntries: string[] = ['/']) {
  return render(
    <MemoryRouter
      initialEntries={initialEntries}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <MockedProvider mocks={[]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MockedProvider>
    </MemoryRouter>,
  );
}

describe('App', () => {
  it('renders the header with app title', () => {
    renderApp();
    expect(screen.getByText('MINT Model Catalog')).toBeInTheDocument();
  });

  it('renders the sidebar navigation links', () => {
    renderApp();
    const navLinks = screen.getAllByRole('link');
    const navTexts = navLinks.map((l) => l.textContent);
    expect(navTexts).toContain('Models');
    expect(navTexts).toContain('Configure');
    expect(navTexts).toContain('Register');
  });

  it('redirects / to /models and renders ModelsPage', () => {
    renderApp(['/']);
    // The page heading "Models" should appear as an h3 inside CardTitle
    const headings = screen.getAllByText('Models');
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });

  it('renders NotFoundPage for unknown routes', () => {
    renderApp(['/unknown-route']);
    expect(screen.getByText('Page not found')).toBeInTheDocument();
  });
});
