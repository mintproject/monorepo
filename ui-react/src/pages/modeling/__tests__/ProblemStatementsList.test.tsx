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

import { renderWithProviders, screen, waitFor, within } from '@/test/utils/render';
import { LIST_TOP_REGIONS } from '@/graphql/queries/regions';
import {
  ListProblemStatementsDocument,
  InsertProblemStatementDocument,
  InsertProblemStatementProvenanceDocument,
  InsertTaskDocument,
  InsertTaskProvenanceDocument,
  InsertThreadDocument,
  InsertThreadProvenanceDocument,
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
    await userEvent.click(regionSelect);
    // Real regions are present; the bogus 'DEFAULT' value is not offered.
    expect(await screen.findByRole('option', { name: 'South Sudan' })).toBeInTheDocument();
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
    await userEvent.click(screen.getByRole('combobox', { name: /region/i }));
    await userEvent.click(await screen.findByRole('option', { name: 'Ethiopia' }));

    await userEvent.type(screen.getByLabelText(/problem statement name/i), 'Test PS');
    await userEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => expect(insertVars.length).toBeGreaterThan(0));
    expect(insertVars[0]?.regionId).toBe('ethiopia');
    expect(insertVars[0]?.regionId).not.toBe('DEFAULT');
  });

  it('auto-provisions a first task and default thread on create', async () => {
    const taskVars: Record<string, unknown>[] = [];
    const taskProvVars: Record<string, unknown>[] = [];
    const threadVars: Record<string, unknown>[] = [];
    const threadProvVars: Record<string, unknown>[] = [];

    const capture =
      (sink: Record<string, unknown>[]) =>
      (vars: Record<string, unknown>): boolean => {
        sink.push(vars);
        return true;
      };

    const mocks: MockedResponse[] = [
      regionsMock,
      listMock('south_sudan'),
      listMock('ethiopia'),
      {
        request: { query: InsertProblemStatementDocument },
        variableMatcher: () => true,
        result: { data: { insert_problem_statement: { returning: [{ id: 'ps-new' }] } } },
      },
      {
        request: { query: InsertProblemStatementProvenanceDocument },
        variableMatcher: () => true,
        result: { data: {} },
      },
      {
        request: { query: InsertTaskDocument },
        variableMatcher: capture(taskVars),
        result: { data: { insert_task: { returning: [{ id: 't-new', threads: [] }] } } },
      },
      {
        request: { query: InsertTaskProvenanceDocument },
        variableMatcher: capture(taskProvVars),
        result: { data: {} },
      },
      {
        request: { query: InsertThreadDocument },
        variableMatcher: capture(threadVars),
        result: { data: { insert_thread: { returning: [{ id: 'th-new' }] } } },
      },
      {
        request: { query: InsertThreadProvenanceDocument },
        variableMatcher: capture(threadProvVars),
        result: { data: { insert_thread_provenance_one: { thread_id: 'th-new' } } },
      },
    ];

    renderWithProviders(<ProblemStatementsList />, {
      apolloMocks: mocks,
      initialEntries: ['/modeling/problem-statements'],
    });

    await userEvent.click(await screen.findByRole('button', { name: /add problem statement/i }));
    await screen.findByRole('combobox', { name: /region/i });
    await userEvent.click(screen.getByRole('combobox', { name: /region/i }));
    await userEvent.click(await screen.findByRole('option', { name: 'Ethiopia' }));
    await userEvent.type(screen.getByLabelText(/problem statement name/i), 'Flood study');
    await userEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => expect(taskVars.length).toBeGreaterThan(0));
    await waitFor(() => expect(threadVars.length).toBeGreaterThan(0));

    // Task seeded from the PS name + region, with both CREATE provenance rows.
    expect(taskVars[0]).toMatchObject({ name: 'Flood study', regionId: 'ethiopia' });
    expect(taskProvVars[0]).toMatchObject({ event: 'CREATE', userid: 'testuser' });
    // Default thread has a null name and a CREATE provenance.
    expect(threadVars[0]).toMatchObject({ name: null });
    expect(threadProvVars[0]).toMatchObject({ event: 'CREATE', userid: 'testuser' });
    // Task and thread are linked, and the thread's CREATE targets that thread.
    expect(threadVars[0]?.taskId).toBe(taskVars[0]?.id);
    expect(threadProvVars[0]?.threadId).toBe(threadVars[0]?.id);
  });

  it('shows task / sub-task / with-a-model counts on each card', async () => {
    const ev = {
      __typename: 'problem_statement_provenance',
      event: 'CREATE',
      timestamp: '2026-01-01T00:00:00+00:00',
      userid: 'testuser',
      notes: null,
    };
    const psWithCounts = {
      __typename: 'problem_statement',
      id: 'ps-counts',
      name: 'Counted study',
      start_date: '2000-01-01',
      end_date: '2020-01-01',
      region_id: 'south_sudan',
      events: [ev],
      permissions: [],
      tasks: [
        {
          __typename: 'task',
          id: 't-1',
          threads: [
            {
              __typename: 'thread',
              id: 'th-1',
              thread_models: [{ __typename: 'thread_model', id: 'tm-1' }],
            },
            { __typename: 'thread', id: 'th-2', thread_models: [] },
          ],
        },
      ],
    };

    const listWithData: MockedResponse = {
      request: { query: ListProblemStatementsDocument, variables: { regionId: 'south_sudan' } },
      result: { data: { problem_statement: [psWithCounts] } },
      maxUsageCount: Number.POSITIVE_INFINITY,
    };

    renderWithProviders(<ProblemStatementsList />, {
      apolloMocks: [regionsMock, listWithData, listMock('ethiopia')],
      initialEntries: ['/modeling/problem-statements'],
    });

    const card = await screen.findByRole('listitem', { name: 'Counted study' });
    // 1 task · 2 sub-tasks · 1 with a model
    expect(within(card).getByText('2')).toBeInTheDocument(); // sub-task count
    expect(within(card).getAllByText('1')).toHaveLength(2); // task count + with-a-model
    expect(within(card).getByText('tasks', { exact: false })).toBeInTheDocument();
    expect(within(card).getByText('sub-tasks', { exact: false })).toBeInTheDocument();
    expect(within(card).getByText('with a model', { exact: false })).toBeInTheDocument();
  });
});
