/**
 * Integration test that validates the testing infrastructure:
 *  - MSW intercepts GraphQL requests to the mocked Hasura endpoint
 *  - Apollo Client resolves queries via MSW handlers (not the real network)
 *  - renderWithProviders wraps components correctly
 *  - auth context mocks are injectable
 *
 * This test uses a real Apollo Client instance (not MockedProvider) to
 * demonstrate that MSW is genuinely intercepting HTTP requests.
 */
import {
  ApolloClient,
  ApolloProvider,
  createHttpLink,
  gql,
  InMemoryCache,
  useQuery,
} from '@apollo/client';
import { act, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '@/test/utils/render';
import { makeQueryMock } from '@/test/utils/apollo-mocks';
import { mockAuthState, mockUnauthenticatedState } from '@/test/utils/auth-mocks';
import { useAuth } from '@/lib/auth/useAuth';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Minimal Apollo Client that routes through MSW (points at the mocked URL) */
function makeMswApolloClient() {
  return new ApolloClient({
    link: createHttpLink({ uri: 'http://localhost:8080/v1/graphql' }),
    cache: new InMemoryCache(),
  });
}

// ─── Fixture components ──────────────────────────────────────────────────────

const GET_STANDARD_VARIABLES = gql`
  query GetStandardVariables {
    modelcatalog_standard_variable {
      id
      label
      description
    }
  }
`;

function StandardVariableList() {
  const { loading, error, data } = useQuery(GET_STANDARD_VARIABLES);
  if (loading) return <div data-testid="loading">Loading...</div>;
  if (error) return <div data-testid="error">{error.message}</div>;
  const vars: Array<{ id: string; label: string }> = data?.modelcatalog_standard_variable ?? [];
  return (
    <ul data-testid="sv-list">
      {vars.map((v) => (
        <li key={v.id} data-testid={`sv-${v.id}`}>
          {v.label}
        </li>
      ))}
    </ul>
  );
}

function AuthStatusDisplay() {
  const { isAuthenticated, user } = useAuth();
  return (
    <div>
      <span data-testid="auth-status">{isAuthenticated ? 'logged-in' : 'logged-out'}</span>
      {user && <span data-testid="username">{user.username}</span>}
    </div>
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('testing infrastructure', () => {
  describe('renderWithProviders', () => {
    it('renders a component inside all required providers', () => {
      renderWithProviders(<div data-testid="hello">Hello</div>);
      expect(screen.getByTestId('hello')).toBeInTheDocument();
    });

    it('provides auth context — authenticated by default', () => {
      renderWithProviders(<AuthStatusDisplay />);
      expect(screen.getByTestId('auth-status')).toHaveTextContent('logged-in');
      expect(screen.getByTestId('username')).toHaveTextContent('testuser');
    });

    it('accepts a custom auth state — unauthenticated', () => {
      renderWithProviders(<AuthStatusDisplay />, {
        authState: mockUnauthenticatedState,
      });
      expect(screen.getByTestId('auth-status')).toHaveTextContent('logged-out');
      expect(screen.queryByTestId('username')).not.toBeInTheDocument();
    });
  });

  describe('MSW GraphQL interception', () => {
    it('intercepts GetStandardVariables and returns mock data', async () => {
      const client = makeMswApolloClient();

      await act(async () => {
        renderWithProviders(
          <ApolloProvider client={client}>
            <StandardVariableList />
          </ApolloProvider>,
        );
      });

      // Initially shows loading state
      // (may flicker through quickly — only assert final state)
      await waitFor(() => {
        expect(screen.getByTestId('sv-list')).toBeInTheDocument();
      });

      // Assert MSW returned the mocked data
      expect(screen.getByText('Groundwater Level')).toBeInTheDocument();
      expect(screen.getByText('Precipitation')).toBeInTheDocument();
    });
  });

  describe('Apollo MockedProvider (unit-style)', () => {
    it('resolves queries from apolloMocks array', async () => {
      const SIMPLE_QUERY = gql`
        query GetModelConfigurations {
          modelcatalog_configuration {
            id
          }
        }
      `;

      function ConfigCount() {
        const { loading, data } = useQuery(SIMPLE_QUERY);
        if (loading) return <span data-testid="loading">loading</span>;
        const count: number = (data?.modelcatalog_configuration ?? []).length;
        return <span data-testid="count">{count}</span>;
      }

      const mock = makeQueryMock(
        SIMPLE_QUERY,
        {},
        {
          modelcatalog_configuration: [
            { id: 'http://example.org/config/1' },
            { id: 'http://example.org/config/2' },
          ],
        },
      );

      renderWithProviders(<ConfigCount />, { apolloMocks: [mock] });

      await waitFor(() => {
        expect(screen.getByTestId('count')).toHaveTextContent('2');
      });
    });
  });

  describe('auth mock constants', () => {
    it('mockAuthState has expected shape', () => {
      expect(mockAuthState.isAuthenticated).toBe(true);
      expect(mockAuthState.isLoading).toBe(false);
      expect(mockAuthState.user?.username).toBe('testuser');
      expect(mockAuthState.accessToken).toBe('mock-access-token');
    });

    it('mockUnauthenticatedState has expected shape', () => {
      expect(mockUnauthenticatedState.isAuthenticated).toBe(false);
      expect(mockUnauthenticatedState.user).toBeNull();
      expect(mockUnauthenticatedState.accessToken).toBeNull();
    });
  });
});
