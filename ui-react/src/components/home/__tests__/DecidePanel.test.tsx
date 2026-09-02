// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { DecidePanel } from '@/components/home/DecidePanel';
import { makeEmptyActivityMock, makeRecentActivityMock } from '@/test/utils/apollo-mocks';
import { mockAuthState, mockUnauthenticatedState } from '@/test/utils/auth-mocks';
import { renderWithProviders } from '@/test/utils/render';

const USER = 'testuser';

describe('DecidePanel', () => {
  it('spells out the four steps of the modeling workflow', () => {
    renderWithProviders(<DecidePanel />, { authState: mockUnauthenticatedState });

    expect(screen.getByText('Frame the problem')).toBeInTheDocument();
    expect(screen.getByText('Break it into tasks')).toBeInTheDocument();
    expect(screen.getByText('Set up a thread')).toBeInTheDocument();
    expect(screen.getByText('Compare results')).toBeInTheDocument();
  });

  it('warns anonymous visitors that the workflow needs a sign-in', () => {
    renderWithProviders(<DecidePanel />, { authState: mockUnauthenticatedState });

    expect(screen.getByRole('link', { name: /start a problem statement/i })).toHaveAttribute(
      'href',
      '/modeling/problem-statements',
    );
    expect(screen.getByText(/you will be asked to sign in first/i)).toBeInTheDocument();
  });

  it('drops the sign-in warning once the user is signed in', async () => {
    renderWithProviders(<DecidePanel />, {
      authState: mockAuthState,
      apolloMocks: [makeEmptyActivityMock(USER)],
    });

    expect(
      screen.getByRole('link', { name: /start a new problem statement/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/you will be asked to sign in first/i)).not.toBeInTheDocument();
  });

  it('offers the problem statements the user touched most recently', async () => {
    renderWithProviders(<DecidePanel />, {
      authState: mockAuthState,
      apolloMocks: [
        makeRecentActivityMock(USER, [
          {
            timestamp: '2026-08-30T10:00:00+00:00',
            problem_statement: { id: 'ps1', name: 'Awash basin crop yield', region_id: 'ethiopia' },
          },
          {
            timestamp: '2026-08-29T10:00:00+00:00',
            problem_statement: { id: 'ps1', name: 'Awash basin crop yield', region_id: 'ethiopia' },
          },
          {
            timestamp: '2026-08-28T10:00:00+00:00',
            problem_statement: { id: 'ps2', name: 'Flood extent 2027', region_id: 'ethiopia' },
          },
        ]),
      ],
    });

    const link = await screen.findByRole('link', { name: /awash basin crop yield/i });
    expect(link).toHaveAttribute('href', '/modeling/problem-statement/ps1');
    expect(screen.getByText('Continue where you left off')).toBeInTheDocument();
    // Deduplicated: two events on ps1 produce one entry.
    expect(screen.getAllByRole('link', { name: /awash basin crop yield/i })).toHaveLength(1);
    expect(screen.getByRole('link', { name: /flood extent 2027/i })).toBeInTheDocument();
  });

  it('hides the resume block when the user has no recent activity', async () => {
    renderWithProviders(<DecidePanel />, {
      authState: mockAuthState,
      apolloMocks: [makeEmptyActivityMock(USER)],
    });

    await waitFor(() => {
      expect(screen.queryByText('Continue where you left off')).not.toBeInTheDocument();
    });
    // The call to action still stands.
    expect(
      screen.getByRole('link', { name: /start a new problem statement/i }),
    ).toBeInTheDocument();
  });

  it('still renders its call to action when the activity query fails', async () => {
    renderWithProviders(<DecidePanel />, {
      authState: mockAuthState,
      apolloMocks: [
        {
          ...makeEmptyActivityMock(USER),
          result: undefined,
          error: new Error('field "problem_statement_provenance" not found'),
        },
      ],
    });

    await waitFor(() => {
      expect(
        screen.getByRole('link', { name: /start a new problem statement/i }),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText('Continue where you left off')).not.toBeInTheDocument();
  });
});
