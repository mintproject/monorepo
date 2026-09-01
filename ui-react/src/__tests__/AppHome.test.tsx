// @vitest-environment jsdom
/**
 * Tests for the landing page.
 *
 * The page is two lanes -- Explore (four catalog entry points) and Decide (the
 * modeling workflow) -- and carries no map: that moved to /regions.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';

import { makeEmptyActivityMock } from '@/test/utils/apollo-mocks';
import { mockAuthState, mockUnauthenticatedState } from '@/test/utils/auth-mocks';
import { setMintConfig } from '@/test/utils/mint-config';
import { renderWithProviders } from '@/test/utils/render';
import { AppHome } from '@/pages/AppHome';

describe('AppHome', () => {
  beforeEach(() => {
    setMintConfig({ GOOGLE_MAPS_KEY: 'test-maps-key', WELCOME_MESSAGE: 'Welcome to DYNAMO' });
  });

  function renderAnonymous() {
    return renderWithProviders(<AppHome />, { authState: mockUnauthenticatedState });
  }

  it('renders the welcome message from the runtime config', () => {
    renderAnonymous();
    expect(screen.getByText('Welcome to DYNAMO')).toBeInTheDocument();
  });

  it('falls back to the default welcome message when the config omits it', () => {
    setMintConfig();

    renderAnonymous();
    expect(screen.getByText('Welcome to MINT Model Catalog')).toBeInTheDocument();
  });

  // ─── Lane A: Explore ───────────────────────────────────────────────────────

  it('offers all four catalog entry points, each linking to its section', () => {
    renderAnonymous();

    expect(screen.getByRole('link', { name: /browse models/i })).toHaveAttribute('href', '/models');
    expect(screen.getByRole('link', { name: /search datasets/i })).toHaveAttribute(
      'href',
      '/datasets/search',
    );
    expect(screen.getByRole('link', { name: /pick a region on the map/i })).toHaveAttribute(
      'href',
      '/regions',
    );
    expect(screen.getByRole('link', { name: /browse variables/i })).toHaveAttribute(
      'href',
      '/variables',
    );
  });

  it('labels the two lanes so the sidebar grouping is visible on arrival', () => {
    renderAnonymous();
    expect(screen.getByRole('heading', { name: /explore what is in mint/i })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /answer a question with models/i }),
    ).toBeInTheDocument();
  });

  it('points at the About page for the DYNAMO description it no longer carries', () => {
    renderAnonymous();
    expect(screen.getByRole('link', { name: /more about dynamo/i })).toHaveAttribute(
      'href',
      '/about',
    );
  });

  it('frames the tool with the questions it is built for', () => {
    renderAnonymous();
    expect(screen.getByText('Questions MINT is built for:')).toBeInTheDocument();
    expect(screen.getByText(/will the harvest fall if the rains are late/i)).toBeInTheDocument();
  });

  // ─── The map is gone ───────────────────────────────────────────────────────

  it('no longer asks for a region before there is anything to filter', () => {
    renderAnonymous();
    expect(screen.queryByText(/select a region by hovering/i)).not.toBeInTheDocument();
  });

  // ─── Auth-aware framing ────────────────────────────────────────────────────

  it('asks anonymous visitors what they want to do', () => {
    renderAnonymous();
    expect(
      screen.getByRole('heading', { level: 1, name: 'What do you want to do?' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/you will be asked to sign in first/i)).toBeInTheDocument();
  });

  it('greets a signed-in user by name', () => {
    renderWithProviders(<AppHome />, {
      authState: {
        ...mockAuthState,
        user: { username: 'analyst1', email: 'a@b.com', sub: 'x' },
      },
      apolloMocks: [makeEmptyActivityMock('analyst1')],
    });

    expect(
      screen.getByRole('heading', { level: 1, name: 'Welcome back, analyst1' }),
    ).toBeInTheDocument();
  });
});
