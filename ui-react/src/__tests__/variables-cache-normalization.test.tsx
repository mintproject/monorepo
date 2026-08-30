// Regression for the /variables Apollo error #5 ("Missing field 'id' while
// writing result ... modelcatalog_variable_presentation").
//
// The real InMemoryCache typePolicies declare
//   modelcatalog_variable_presentation: { keyFields: ['id'] }
// so every presentation object the cache normalizes must carry `id`. The
// GetStandardVariablesWithUnits query previously selected the presentation's
// `unit` but not its `id`, so Apollo could not compute the cache key and threw.
//
// MockedProvider does NOT apply typePolicies, so component tests cannot catch
// this — the assertion must run against the real cache + real generated document.
import { InMemoryCache } from '@apollo/client';
import { print } from 'graphql';
import { describe, it, expect } from 'vitest';

import { GetStandardVariablesWithUnitsDocument } from '@/graphql/generated/graphql';
import { typePolicies } from '@/lib/apollo-client';

describe('GetStandardVariablesWithUnits cache normalization', () => {
  it('selects id on variable_presentations so the keyed cache can normalize it', () => {
    // Guards the query side: without `id` here the document regresses and the
    // real cache below can no longer key each presentation.
    const source = print(GetStandardVariablesWithUnitsDocument);
    const presentationSelection = source.slice(source.indexOf('variable_presentations'));
    expect(presentationSelection).toMatch(/variable_presentations\s*{\s*id/);
  });

  it('writes the query result into the real keyed cache without throwing', () => {
    const cache = new InMemoryCache({ typePolicies });

    const data = {
      modelcatalog_standard_variable: [
        {
          __typename: 'modelcatalog_standard_variable',
          id: 'sv-1',
          label: 'Temperature',
          description: 'desc',
          same_as: null,
          variable_presentations: [
            // A presentation with a null unit — the exact object from the
            // reported error payload — must still normalize cleanly.
            { __typename: 'modelcatalog_variable_presentation', id: 'vp-1', unit: null },
          ],
        },
      ],
    };

    expect(() =>
      cache.writeQuery({ query: GetStandardVariablesWithUnitsDocument, data }),
    ).not.toThrow();
  });
});
