import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AppShell } from '../AppShell';

vi.mock('@/lib/auth/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    user: null,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

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
});
