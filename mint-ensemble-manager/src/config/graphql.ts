import 'cross-fetch/polyfill';
import { ApolloClient, createHttpLink, InMemoryCache, NormalizedCacheObject, split } from '@apollo/client';
import { fillConfigurationFromEnvironment, MintPreferences, User } from '../classes/mint/mint-types';

import * as mintConfig from './config.json';
import { KeycloakAdapter } from './keycloak-adapter';

export class GraphQL {
  static client : ApolloClient<NormalizedCacheObject>;
  static userId;

  static instance = (auth:User) => {
    if(GraphQL.client != null && auth.email && auth.email == GraphQL.userId)
      return GraphQL.client
    GraphQL.userId = auth?.email;

    // Create the Apollo GraphQL Client
    GraphQL.client = new ApolloClient({
      link: GraphQL.getHTTPSLink(),
      cache: new InMemoryCache()
    });
    return GraphQL.client;
  }

  static getHTTPSLink() {
    let prefs = mintConfig["default"] as MintPreferences;
    fillConfigurationFromEnvironment(prefs)
    
    // Normal HTTP Link
    let protocol = prefs.graphql.enable_ssl? "https://" : "http://"
    let uri = protocol + prefs.graphql.endpoint
    
    return createHttpLink({
      uri: uri,
      headers: prefs.graphql.secret ?  
        { "X-Hasura-Admin-Secret": prefs.graphql.secret } :  KeycloakAdapter.getAccessTokenHeader()
    });
  }
}

