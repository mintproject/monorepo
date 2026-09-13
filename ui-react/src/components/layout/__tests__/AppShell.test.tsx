import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from '../AppShell';

vi.mock('@/lib/auth/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    user: null,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

afterEach(() => {
  delete (window as { __MINT_CONFIG__?: unknown }).__MINT_CONFIG__;
});

describe('AppShell', () => {
  it('renders children inside main area', () => {
    render(
      <MemoryRouter>
        <AppShell>
          <div data-testid="content">Hello</div>
        </AppShell>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('renders the header and sidebar', () => {
    render(
      <MemoryRouter>
        <AppShell>
          <span />
        </AppShell>
      </MemoryRouter>,
    );
    expect(screen.getByText('MINT Model Catalog')).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('collapses the sidebar when the menu button is clicked', async () => {
    render(
      <MemoryRouter>
        <AppShell>
          <span />
        </AppShell>
      </MemoryRouter>,
    );
    const sidebar = screen.getByRole('complementary');
    expect(sidebar).toHaveClass('w-60');

    const menuBtn = screen.getByRole('button', { name: /collapse sidebar/i });
    await userEvent.click(menuBtn);

    expect(sidebar).toHaveClass('w-14');
  });

  it('shows the branding strip and the footer under BRANDING=tacc', () => {
    window.__MINT_CONFIG__ = { BRANDING: 'tacc' } as never;
    render(
      <MemoryRouter>
        <AppShell>
          <span />
        </AppShell>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('branding-strip')).toBeInTheDocument();
    expect(screen.getByAltText('TACC Logo')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('keeps the footer but drops the strip under BRANDING=none', () => {
    window.__MINT_CONFIG__ = { BRANDING: 'none' } as never;
    render(
      <MemoryRouter>
        <AppShell>
          <span />
        </AppShell>
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('branding-strip')).not.toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('drops the strip when the key is absent', () => {
    render(
      <MemoryRouter>
        <AppShell>
          <span />
        </AppShell>
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('branding-strip')).not.toBeInTheDocument();
  });
});
