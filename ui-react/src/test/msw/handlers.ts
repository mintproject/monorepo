/**
 * Default MSW request handlers for Hasura GraphQL endpoint.
 *
 * These handlers mock the Hasura /v1/graphql endpoint. Each handler
 * matches on the `operationName` field in the request body. Tests can
 * override individual handlers via server.use(...) within the test.
 */
import { graphql, HttpResponse } from 'msw';

// Hasura endpoint path used in tests — matches the default dev config
export const HASURA_URL = 'http://localhost:8080/v1/graphql';

const hasura = graphql.link(HASURA_URL);

export const handlers = [
  // Standard Variables list (prefetch autocomplete)
  hasura.query('GetStandardVariables', () => {
    return HttpResponse.json({
      data: {
        modelcatalog_standard_variable: [
          {
            id: 'https://w3id.org/okn/i/mint/Groundwater_Level',
            label: 'Groundwater Level',
            description: 'Water table depth below land surface',
          },
          {
            id: 'https://w3id.org/okn/i/mint/Precipitation',
            label: 'Precipitation',
            description: 'Total precipitation',
          },
        ],
      },
    });
  }),

  // Units list (prefetch autocomplete)
  hasura.query('GetUnits', () => {
    return HttpResponse.json({
      data: {
        modelcatalog_unit: [
          {
            id: 'https://w3id.org/okn/i/mint/meter',
            label: 'meter',
            symbol: 'm',
          },
          {
            id: 'https://w3id.org/okn/i/mint/millimeter',
            label: 'millimeter',
            symbol: 'mm',
          },
        ],
      },
    });
  }),

  // Model configurations list
  hasura.query('GetModelConfigurations', () => {
    return HttpResponse.json({
      data: {
        modelcatalog_configuration: [],
      },
    });
  }),

  // Single model configuration
  hasura.query('GetModelConfiguration', ({ variables }) => {
    return HttpResponse.json({
      data: {
        modelcatalog_configuration_by_pk: variables.id
          ? {
              id: variables.id as string,
              label: 'Test Configuration',
              description: 'A test model configuration',
              model_configuration_id: null,
              configuration_inputs: [],
              configuration_outputs: [],
            }
          : null,
      },
    });
  }),
];
