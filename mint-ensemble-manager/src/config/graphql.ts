import 'cross-fetch/polyfill';
import { ApolloClient, createHttpLink, InMemoryCache, NormalizedCacheObject } from '@apollo/client';

const ENDPOINT = "graphql.dev.mint.isi.edu/v1/graphql";
//const SECRET = "WmGrIc4MxU";
const SECRET = "secret";

export class GraphQL {
  static client : ApolloClient<NormalizedCacheObject>;

  static instance = () => {
    if(GraphQL.client != null)
      return GraphQL.client

    // Create the Apollo GraphQL Client
    GraphQL.client = new ApolloClient({
      link: GraphQL.getHTTPSLink(),
      cache: new InMemoryCache(),
      defaultOptions: {
        query: {
          fetchPolicy: 'no-cache',
          errorPolicy: 'all',
        }
      }
    });

    return GraphQL.client;
  }

  static getHTTPSLink() {
    // Normal HTTP Link
    return createHttpLink({
      uri: "https://" + ENDPOINT,
      headers: {
        "X-Hasura-Admin-Secret": SECRET
      }
    });
  }
}

