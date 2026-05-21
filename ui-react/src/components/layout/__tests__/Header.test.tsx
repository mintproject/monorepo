import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { Header } from '../Header';

// Minimal auth mock
vi.mock('@/lib/auth/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    user: null,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

function renderHeader(
  props: { sidebarCollapsed?: boolean; onToggleSidebar?: () => void } = {},
) {
  const onToggleSidebar = props.onToggleSidebar ?? vi.fn();
  return render(
    <MemoryRouter>
      <Header
        sidebarCollapsed={props.sidebarCollapsed ?? false}
        onToggleSidebar={onToggleSidebar}
      />
    </MemoryRouter>,
  );
}

describe('Header', () => {
  it('renders the app title', () => {
    renderHeader();
    expect(screen.getByText('MINT Model Catalog')).toBeInTheDocument();
  });

  it('shows Sign In button when not authenticated', () => {
    renderHeader();
    expect(
      screen.getByRole('button', { name: /sign in/i }),
    ).toBeInTheDocument();
  });

  it('calls onToggleSidebar when menu button is clicked', async () => {
    const onToggle = vi.fn();
    renderHeader({ onToggleSidebar: onToggle });
    const menuBtn = screen.getByRole('button', { name: /collapse sidebar/i });
    await userEvent.click(menuBtn);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('shows Expand sidebar label when sidebar is collapsed', () => {
    renderHeader({ sidebarCollapsed: true });
    expect(
      screen.getByRole('button', { name: /expand sidebar/i }),
    ).toBeInTheDocument();
  });
});
