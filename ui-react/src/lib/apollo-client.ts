import {
  ApolloClient,
  InMemoryCache,
  type InMemoryCacheConfig,
  createHttpLink,
} from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

import { getAccessToken } from './auth/token-store';

function getConfig() {
  return (
    window.__MINT_CONFIG__ ?? {
      HASURA_ENDPOINT:
        import.meta.env.VITE_HASURA_ENDPOINT ?? 'http://graphql.mint.local/v1/graphql',
      AUTH_SERVER: import.meta.env.VITE_AUTH_SERVER ?? 'https://portals.tapis.io',
      AUTH_CLIENT_ID: import.meta.env.VITE_AUTH_CLIENT_ID ?? 'mint-local',
      AUTH_REALM: import.meta.env.VITE_AUTH_REALM ?? '',
      AUTH_PROVIDER: (import.meta.env.VITE_AUTH_PROVIDER as 'keycloak' | 'tapis') ?? 'tapis',
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

/**
 * Cache type policies for the MINT model catalog schema.
 *
 * Junction tables use composite primary keys (two FK columns), so we must
 * explicitly define keyFields for each junction type to prevent Apollo cache
 * collisions. Entity tables use their id field (URI text PK).
 *
 * See: .planning/research/backend-inventory.md §1.2 for full junction table list.
 */
/**
 * Cache type policies, exported so tests can build an InMemoryCache with the
 * real junction keyFields and verify that queries select the fields the cache
 * needs to normalize (MockedProvider does not apply these policies).
 */
export const typePolicies: InMemoryCacheConfig['typePolicies'] = {
  // Entity tables — single PK (URI text)
  modelcatalog_software: { keyFields: ['id'] },
  modelcatalog_software_version: { keyFields: ['id'] },
  modelcatalog_configuration: { keyFields: ['id'] },
  modelcatalog_dataset_specification: { keyFields: ['id'] },
  modelcatalog_parameter: { keyFields: ['id'] },
  modelcatalog_variable_presentation: { keyFields: ['id'] },
  modelcatalog_standard_variable: { keyFields: ['id'] },
  modelcatalog_unit: { keyFields: ['id'] },
  modelcatalog_person: { keyFields: ['id'] },
  modelcatalog_model_category: { keyFields: ['id'] },
  modelcatalog_region: { keyFields: ['id'] },
  modelcatalog_process: { keyFields: ['id'] },
  modelcatalog_time_interval: { keyFields: ['id'] },
  modelcatalog_causal_diagram: { keyFields: ['id'] },
  modelcatalog_image: { keyFields: ['id'] },
  modelcatalog_intervention: { keyFields: ['id'] },
  modelcatalog_grid: { keyFields: ['id'] },

  // Configuration junction tables — composite PKs
  modelcatalog_configuration_input: {
    keyFields: ['configuration_id', 'input_id'],
  },
  modelcatalog_configuration_output: {
    keyFields: ['configuration_id', 'output_id'],
  },
  modelcatalog_configuration_parameter: {
    keyFields: ['configuration_id', 'parameter_id'],
  },
  modelcatalog_configuration_author: {
    keyFields: ['configuration_id', 'person_id'],
  },
  modelcatalog_configuration_category: {
    keyFields: ['configuration_id', 'category_id'],
  },
  modelcatalog_configuration_causal_diagram: {
    keyFields: ['configuration_id', 'causal_diagram_id'],
  },
  modelcatalog_configuration_time_interval: {
    keyFields: ['configuration_id', 'time_interval_id'],
  },
  modelcatalog_configuration_region: {
    keyFields: ['configuration_id', 'region_id'],
  },
  modelcatalog_configuration_calibrated_variable: {
    keyFields: ['configuration_id', 'variable_id'],
  },
  modelcatalog_configuration_calibration_target: {
    keyFields: ['configuration_id', 'variable_id'],
  },

  // Software/Version junction tables — composite PKs
  modelcatalog_software_author: {
    keyFields: ['software_id', 'person_id'],
  },
  modelcatalog_software_category: {
    keyFields: ['software_id', 'category_id'],
  },
  modelcatalog_version_author: {
    keyFields: ['software_version_id', 'person_id'],
  },
  modelcatalog_software_version_category: {
    keyFields: ['software_version_id', 'category_id'],
  },
  modelcatalog_software_version_process: {
    keyFields: ['software_version_id', 'process_id'],
  },
  modelcatalog_software_version_grid: {
    keyFields: ['software_version_id', 'grid_id'],
  },
  modelcatalog_software_version_image: {
    keyFields: ['software_version_id', 'image_id'],
  },
  modelcatalog_software_version_input_variable: {
    keyFields: ['software_version_id', 'variable_id'],
  },
  modelcatalog_software_version_output_variable: {
    keyFields: ['software_version_id', 'variable_id'],
  },

  // Other junction tables
  modelcatalog_parameter_intervention: {
    keyFields: ['parameter_id', 'intervention_id'],
  },
  modelcatalog_parameter_adjusts_variable: {
    keyFields: ['parameter_id', 'variable_id'],
  },
  modelcatalog_dataset_specification_presentation: {
    keyFields: ['dataset_specification_id', 'presentation_id'],
  },
};

const cache = new InMemoryCache({ typePolicies });

export const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache,
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
  },
});
