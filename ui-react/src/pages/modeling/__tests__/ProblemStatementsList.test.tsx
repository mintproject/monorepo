/**
 * Tests for ProblemStatementsList — focus on region selection.
 *
 * Regression: creating a problem statement failed with a foreign-key
 * violation because the insert hardcoded region_id = 'DEFAULT', a region
 * that does not exist. The dialog must let the user pick a real region.
 */
import { describe, expect, it } from 'vitest';
import type { MockedResponse } from '@apollo/client/testing';
import userEvent from '@testing-library/user-event';

import { renderWithProviders, screen, waitFor } from '@/test/utils/render';
import { LIST_TOP_REGIONS } from '@/graphql/queries/regions';
import {
  ListProblemStatementsDocument,
  InsertProblemStatementDocument,
  InsertProblemStatementProvenanceDocument,
} from '@/graphql/generated/modeling';
import { ProblemStatementsList } from '../ProblemStatementsList';

const mockRegions = [
  { id: 'south_sudan', name: 'South Sudan', model_catalog_uri: null, geometries: [] },
  { id: 'ethiopia', name: 'Ethiopia', model_catalog_uri: null, geometries: [] },
];

const regionsMock: MockedResponse = {
  request: { query: LIST_TOP_REGIONS },
  result: { data: { region: mockRegions } },
};

function listMock(regionId: string): MockedResponse {
  return {
    request: { query: ListProblemStatementsDocument, variables: { regionId } },
    result: { data: { problem_statement: [] } },
    maxUsageCount: Number.POSITIVE_INFINITY,
  };
}

describe('ProblemStatementsList region selection', () => {
  it('offers a region selector populated from the real top-level regions', async () => {
    renderWithProviders(<ProblemStatementsList />, {
      apolloMocks: [regionsMock, listMock('south_sudan'), listMock('ethiopia')],
      initialEntries: ['/modeling/problem-statements'],
    });

    const addBtn = await screen.findByRole('button', { name: /add problem statement/i });
    await userEvent.click(addBtn);

    const regionSelect = await screen.findByRole('combobox', { name: /region/i });
    expect(regionSelect).toBeInTheDocument();
    // Real regions are present; the bogus 'DEFAULT' value is not offered.
    expect(screen.getByRole('option', { name: 'South Sudan' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Ethiopia' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /default/i })).not.toBeInTheDocument();
  });

  it('inserts the selected region id, never the bogus DEFAULT', async () => {
    const insertVars: Record<string, unknown>[] = [];
    const insertMock: MockedResponse = {
      request: { query: InsertProblemStatementDocument },
      variableMatcher: (vars) => {
        insertVars.push(vars);
        return true;
      },
      result: {
        data: { insert_problem_statement: { returning: [{ id: 'mint://problem_statement/new' }] } },
      },
    };
    const provenanceMock: MockedResponse = {
      request: { query: InsertProblemStatementProvenanceDocument },
      variableMatcher: () => true,
      result: { data: {} },
    };

    renderWithProviders(<ProblemStatementsList />, {
      apolloMocks: [
        regionsMock,
        listMock('south_sudan'),
        listMock('ethiopia'),
        insertMock,
        provenanceMock,
      ],
      initialEntries: ['/modeling/problem-statements'],
    });

    await userEvent.click(await screen.findByRole('button', { name: /add problem statement/i }));

    await screen.findByRole('combobox', { name: /region/i });
    const regionSelect = screen.getByRole('combobox', { name: /region/i });
    await userEvent.selectOptions(regionSelect, 'ethiopia');

    await userEvent.type(screen.getByLabelText(/problem statement name/i), 'Test PS');
    await userEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => expect(insertVars.length).toBeGreaterThan(0));
    expect(insertVars[0]?.regionId).toBe('ethiopia');
    expect(insertVars[0]?.regionId).not.toBe('DEFAULT');
  });
});
