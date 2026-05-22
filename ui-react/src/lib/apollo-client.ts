import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

import { getAccessToken } from './auth/token-store';

function getConfig() {
  return (
    window.__MINT_CONFIG__ ?? {
      HASURA_ENDPOINT: import.meta.env.VITE_HASURA_ENDPOINT ?? 'http://localhost:8080/v1/graphql',
      AUTH_SERVER: import.meta.env.VITE_AUTH_SERVER ?? '',
      AUTH_CLIENT_ID: import.meta.env.VITE_AUTH_CLIENT_ID ?? '',
      AUTH_REALM: import.meta.env.VITE_AUTH_REALM ?? '',
      AUTH_PROVIDER: (import.meta.env.VITE_AUTH_PROVIDER as 'keycloak' | 'tapis') ?? 'keycloak',
    }
  );
}

const httpLink = createHttpLink({
  uri: () => getConfig().HASURA_ENDPOINT,
});

/**
 * Auth link: reads the current access token from the token store on every request.
 * Using setContext ensures stale tokens are never baked into the client at creation time —
 * the token is fetched fresh per request.
 *
 * Anonymous reads (no header) -> Hasura anonymous role (SELECT only).
 * Authenticated writes -> JWT with x-hasura-* claims -> user role (full CRUD).
 */
const authLink = setContext((_, { headers }: { headers?: Record<string, string> }) => {
  const token = getAccessToken();
  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
});

export const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
  },
});
