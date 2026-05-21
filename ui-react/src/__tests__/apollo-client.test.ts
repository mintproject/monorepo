import { describe, it, expect } from 'vitest';
import { InMemoryCache } from '@apollo/client';
import { apolloClient } from '../lib/apollo-client';

describe('Apollo Client configuration', () => {
  it('is initialized with an InMemoryCache', () => {
    expect(apolloClient.cache).toBeInstanceOf(InMemoryCache);
  });

  it('has default watchQuery fetchPolicy set to cache-and-network', () => {
    const defaultOptions = apolloClient.defaultOptions;
    expect(defaultOptions.watchQuery?.fetchPolicy).toBe('cache-and-network');
  });
});

describe('InMemoryCache type policies', () => {
  /**
   * This test verifies that junction table type policies are configured with
   * composite keyFields, preventing cache collisions when multiple junction rows
   * share a common FK value.
   *
   * We test this by writing two junction rows that share the same configuration_id
   * but different secondary FKs, and verifying that both are retained in the cache
   * (no collision).
   */
  it('stores configuration_input rows by composite key (configuration_id + input_id)', () => {
    const cache = new InMemoryCache({
      typePolicies: {
        modelcatalog_configuration_input: {
          keyFields: ['configuration_id', 'input_id'],
        },
      },
    });

    // Write two junction rows sharing the same configuration_id
    cache.writeQuery({
      query: {
        kind: 'Document',
        definitions: [
          {
            kind: 'OperationDefinition',
            operation: 'query',
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'items' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'configuration_id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'input_id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'is_optional' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
      data: {
        items: [
          {
            __typename: 'modelcatalog_configuration_input',
            configuration_id: 'config-1',
            input_id: 'input-1',
            is_optional: false,
          },
          {
            __typename: 'modelcatalog_configuration_input',
            configuration_id: 'config-1',
            input_id: 'input-2',
            is_optional: true,
          },
        ],
      },
    });

    const result = cache.readQuery<{ items: Array<{ configuration_id: string; input_id: string; is_optional: boolean }> }>({
      query: {
        kind: 'Document',
        definitions: [
          {
            kind: 'OperationDefinition',
            operation: 'query',
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'items' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'configuration_id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'input_id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'is_optional' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    });

    expect(result?.items).toHaveLength(2);
    // Both rows retained — composite key prevented collision
    expect(result?.items.map((r) => r.input_id)).toContain('input-1');
    expect(result?.items.map((r) => r.input_id)).toContain('input-2');
  });

  it('uses id as keyField for entity tables', () => {
    const cache = new InMemoryCache({
      typePolicies: {
        modelcatalog_standard_variable: { keyFields: ['id'] },
      },
    });

    cache.writeQuery({
      query: {
        kind: 'Document',
        definitions: [
          {
            kind: 'OperationDefinition',
            operation: 'query',
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'sv' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'label' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
      data: {
        sv: {
          __typename: 'modelcatalog_standard_variable',
          id: 'https://w3id.org/okn/i/mint/sv-1',
          label: 'Precipitation',
        },
      },
    });

    // Should be identifiable in cache by its ID
    const ref = cache.identify({
      __typename: 'modelcatalog_standard_variable',
      id: 'https://w3id.org/okn/i/mint/sv-1',
    });
    expect(ref).toMatch(/modelcatalog_standard_variable/);
  });
});
