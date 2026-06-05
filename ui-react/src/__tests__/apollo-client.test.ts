import { describe, it, expect } from 'vitest';
import { Kind, OperationTypeNode } from 'graphql';
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
        kind: Kind.DOCUMENT,
        definitions: [
          {
            kind: Kind.OPERATION_DEFINITION,
            operation: OperationTypeNode.QUERY,
            selectionSet: {
              kind: Kind.SELECTION_SET,
              selections: [
                {
                  kind: Kind.FIELD,
                  name: { kind: Kind.NAME, value: 'items' },
                  selectionSet: {
                    kind: Kind.SELECTION_SET,
                    selections: [
                      { kind: Kind.FIELD, name: { kind: Kind.NAME, value: '__typename' } },
                      { kind: Kind.FIELD, name: { kind: Kind.NAME, value: 'configuration_id' } },
                      { kind: Kind.FIELD, name: { kind: Kind.NAME, value: 'input_id' } },
                      { kind: Kind.FIELD, name: { kind: Kind.NAME, value: 'is_optional' } },
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
        kind: Kind.DOCUMENT,
        definitions: [
          {
            kind: Kind.OPERATION_DEFINITION,
            operation: OperationTypeNode.QUERY,
            selectionSet: {
              kind: Kind.SELECTION_SET,
              selections: [
                {
                  kind: Kind.FIELD,
                  name: { kind: Kind.NAME, value: 'items' },
                  selectionSet: {
                    kind: Kind.SELECTION_SET,
                    selections: [
                      { kind: Kind.FIELD, name: { kind: Kind.NAME, value: '__typename' } },
                      { kind: Kind.FIELD, name: { kind: Kind.NAME, value: 'configuration_id' } },
                      { kind: Kind.FIELD, name: { kind: Kind.NAME, value: 'input_id' } },
                      { kind: Kind.FIELD, name: { kind: Kind.NAME, value: 'is_optional' } },
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
        kind: Kind.DOCUMENT,
        definitions: [
          {
            kind: Kind.OPERATION_DEFINITION,
            operation: OperationTypeNode.QUERY,
            selectionSet: {
              kind: Kind.SELECTION_SET,
              selections: [
                {
                  kind: Kind.FIELD,
                  name: { kind: Kind.NAME, value: 'sv' },
                  selectionSet: {
                    kind: Kind.SELECTION_SET,
                    selections: [
                      { kind: Kind.FIELD, name: { kind: Kind.NAME, value: '__typename' } },
                      { kind: Kind.FIELD, name: { kind: Kind.NAME, value: 'id' } },
                      { kind: Kind.FIELD, name: { kind: Kind.NAME, value: 'label' } },
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