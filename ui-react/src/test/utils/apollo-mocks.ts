/**
 * Apollo mock helpers for common query/mutation shapes.
 *
 * These are pre-built MockedResponse objects for Hasura queries used
 * across tests. Import them directly or compose with server.use() for
 * MSW-based integration tests.
 *
 * Usage:
 *   import { makeQueryMock, makeErrorMock } from '@/test/utils/apollo-mocks';
 *
 *   renderWithProviders(<MyComponent />, {
 *     apolloMocks: [makeQueryMock(MY_QUERY, { id: '123' }, { data: {...} })],
 *   });
 */
import type { MockedResponse } from '@apollo/client/testing';
import type { DocumentNode } from 'graphql';

import { ACTIVITY_ROWS } from '@/components/home/DecidePanel';
import {
  ListRecentProblemStatementActivityDocument,
  type ListRecentProblemStatementActivityQuery,
} from '@/graphql/generated/modeling';

/**
 * Create a successful Apollo MockedResponse.
 * TVariables constrains the variable shape; the data payload is typed loosely
 * to avoid conflicts with Apollo's internal Unmasked<TData> constraint.
 */
export function makeQueryMock<TVariables extends Record<string, unknown>>(
  query: DocumentNode,
  variables: TVariables,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
): MockedResponse {
  return {
    request: { query, variables },
    result: { data },
  };
}

/**
 * Create an error Apollo MockedResponse (GraphQL error).
 */
export function makeErrorMock<TVariables extends Record<string, unknown>>(
  query: DocumentNode,
  variables: TVariables,
  errorMessage: string,
): MockedResponse {
  return {
    request: { query, variables },
    result: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      errors: [{ message: errorMessage } as any],
    },
  };
}

/**
 * Create a network error Apollo MockedResponse.
 */
export function makeNetworkErrorMock<TVariables extends Record<string, unknown>>(
  query: DocumentNode,
  variables: TVariables,
  errorMessage = 'Network error',
): MockedResponse {
  return {
    request: { query, variables },
    error: new Error(errorMessage),
  };
}

// ─── Modeling: the Decide panel's recent-activity feed ───────────────────────

/**
 * The provenance feed `DecidePanel` reads when a user is signed in.
 * `limit` comes from `ACTIVITY_ROWS` so the mock cannot drift from the query.
 */
export function makeRecentActivityMock(
  userid: string,
  rows: ListRecentProblemStatementActivityQuery['problem_statement_provenance'],
): MockedResponse {
  return makeQueryMock(
    ListRecentProblemStatementActivityDocument,
    { userid, limit: ACTIVITY_ROWS },
    { problem_statement_provenance: rows },
  );
}

/** A signed-in user who has not touched a problem statement yet. */
export function makeEmptyActivityMock(userid: string): MockedResponse {
  return makeRecentActivityMock(userid, []);
}
