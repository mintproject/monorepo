import 'cross-fetch/polyfill';
import { ApolloClient, createHttpLink, InMemoryCache, NormalizedCacheObject } from '@apollo/client';

const ENDPOINT = "graphql.mint.isi.edu/v1/graphql";
const SECRET = "WmGrIc4MxU";

export class GraphQL {
  static client : ApolloClient<NormalizedCacheObject>;

  static instance = () => {
    if(GraphQL.client != null)
      return GraphQL.client

    // Create the Apollo GraphQL Client
    GraphQL.client = new ApolloClient({
      link: GraphQL.getHTTPSLink(),
      cache: new InMemoryCache()
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

