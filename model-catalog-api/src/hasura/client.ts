import { ApolloClient, InMemoryCache, HttpLink, gql } from '@apollo/client/core'

const HASURA_GRAPHQL_URL = process.env.HASURA_GRAPHQL_URL || 'http://localhost:8080/v1/graphql'
const HASURA_ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET

// Read client: uses admin secret for public data reads (no auth required)
// fetchPolicy: 'no-cache' ensures always fresh data from Hasura
export const readClient = new ApolloClient({
  link: new HttpLink({
    uri: HASURA_GRAPHQL_URL,
    headers: {
      ...(HASURA_ADMIN_SECRET
        ? { 'X-Hasura-Admin-Secret': HASURA_ADMIN_SECRET }
        : {}),
    },
    fetch: globalThis.fetch,
  }),
  cache: new InMemoryCache(),
  defaultOptions: {
    query: {
      fetchPolicy: 'no-cache',
    },
  },
})

// Write client factory: creates a new ApolloClient per request with user's JWT forwarded
// Hasura row-level permissions enforce user scoping based on the JWT claims
export function getWriteClient(bearerToken: string): ApolloClient {
  return new ApolloClient({
    link: new HttpLink({
      uri: HASURA_GRAPHQL_URL,
      headers: {
        Authorization: bearerToken,
      },
      fetch: globalThis.fetch,
    }),
    cache: new InMemoryCache(),
    defaultOptions: {
      query: {
        fetchPolicy: 'no-cache',
      },
    },
  })
}

// Re-export gql tag for convenience in handler files
export { gql }
