/**
 * Tests for MintProblemStatement — the adaptive right panel and the sub-task
 * status dots (P1-2).
 *
 * The right panel shows a problem-statement overview when nothing is selected,
 * and embeds the thread wizard inline when a sub-task is selected.
 */
import { describe, expect, it } from 'vitest';
import type { MockedResponse } from '@apollo/client/testing';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';

import { renderWithProviders, screen, within } from '@/test/utils/render';
import { LIST_TOP_REGIONS } from '@/graphql/queries/regions';
import {
  GetProblemStatementDocument,
  GetThreadDocument,
  GetModelTreeWithRegionsDocument,
} from '@/graphql/generated/modeling';
import { MintProblemStatement } from '../MintProblemStatement';

const ts = '2026-01-01T00:00:00+00:00';

const threadWithModel = {
  __typename: 'thread',
  id: 'th-model',
  name: 'Rainfed scenario',
  task_id: 't-1',
  start_date: '2000-01-01',
  end_date: '2020-01-01',
  region_id: 'south_sudan',
  driving_variable_id: 'v-precip',
  response_variable_id: 'v-yield',
  driving_variable: { __typename: 'variable', id: 'v-precip', name: 'precipitation' },
  response_variable: { __typename: 'variable', id: 'v-yield', name: 'crop yield' },
  events: [
    {
      __typename: 'thread_provenance',
      event: 'CREATE',
      timestamp: ts,
      userid: 'testuser',
      notes: null,
    },
  ],
  permissions: [],
  thread_models: [
    {
      __typename: 'thread_model',
      id: 'tm-1',
      thread_id: 'th-model',
      model_id: null,
      modelcatalog_configuration_id: 'cfg-1',
      modelcatalog_configuration: {
        __typename: 'modelcatalog_configuration',
        id: 'cfg-1',
        label: 'CYCLES',
      },
    },
  ],
};

const threadEmpty = {
  __typename: 'thread',
  id: 'th-empty',
  name: 'Irrigated scenario',
  task_id: 't-1',
  start_date: '2000-01-01',
  end_date: '2020-01-01',
  region_id: 'south_sudan',
  driving_variable_id: null,
  response_variable_id: null,
  driving_variable: null,
  response_variable: null,
  events: [
    {
      __typename: 'thread_provenance',
      event: 'CREATE',
      timestamp: ts,
      userid: 'testuser',
      notes: null,
    },
  ],
  permissions: [],
  thread_models: [],
};

const problemStatement = {
  __typename: 'problem_statement',
  id: 'ps-1',
  name: 'Flood study',
  start_date: '2000-01-01',
  end_date: '2020-01-01',
  region_id: 'south_sudan',
  events: [
    {
      __typename: 'problem_statement_provenance',
      event: 'CREATE',
      timestamp: ts,
      userid: 'testuser',
      notes: null,
    },
  ],
  permissions: [],
  tasks: [
    {
      __typename: 'task',
      id: 't-1',
      name: 'Crop modeling',
      problem_statement_id: 'ps-1',
      start_date: '2000-01-01',
      end_date: '2020-01-01',
      region_id: 'south_sudan',
      driving_variable_id: null,
      response_variable_id: null,
      events: [
        {
          __typename: 'task_provenance',
          event: 'CREATE',
          timestamp: ts,
          userid: 'testuser',
          notes: null,
        },
      ],
      permissions: [],
      threads: [threadWithModel, threadEmpty],
    },
  ],
};

function mocks(): MockedResponse[] {
  return [
    {
      request: { query: GetProblemStatementDocument, variables: { id: 'ps-1' } },
      result: { data: { problem_statement_by_pk: problemStatement } },
      maxUsageCount: Number.POSITIVE_INFINITY,
    },
    // Used only when a sub-task is selected (the inline wizard loads the thread).
    {
      request: { query: GetThreadDocument, variables: { id: 'th-model' } },
      result: { data: { thread_by_pk: threadWithModel } },
      maxUsageCount: Number.POSITIVE_INFINITY,
    },
    {
      request: { query: GetModelTreeWithRegionsDocument },
      result: { data: { modelcatalog_software: [] } },
      maxUsageCount: Number.POSITIVE_INFINITY,
    },
    {
      request: { query: LIST_TOP_REGIONS },
      result: { data: { region: [] } },
      maxUsageCount: Number.POSITIVE_INFINITY,
    },
  ];
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/modeling/problem-statement/:id" element={<MintProblemStatement />} />
    </Routes>,
    {
      apolloMocks: mocks(),
      initialEntries: ['/modeling/problem-statement/ps-1'],
    },
  );
}

describe('MintProblemStatement detail panel', () => {
  it('shows the problem overview when no sub-task is selected', async () => {
    renderPage();

    expect(await screen.findByText('Recent activity')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Sub-tasks')).toBeInTheDocument();
    expect(screen.getByText(/empty/)).toBeInTheDocument();
  });

  it('renders emerald/amber status dots per sub-task model state', async () => {
    renderPage();

    const tree = await screen.findByRole('tree');
    await userEvent.click(within(tree).getByText('Crop modeling'));

    expect(await screen.findByLabelText('Model selected')).toBeInTheDocument();
    expect(screen.getByLabelText('No model yet')).toBeInTheDocument();
  });

  it('embeds the thread wizard inline when a sub-task is selected', async () => {
    renderPage();

    const tree = await screen.findByRole('tree');
    await userEvent.click(within(tree).getByText('Crop modeling'));
    await userEvent.click(within(tree).getByText('Rainfed scenario'));

    // The wizard mounts inline (no full-page navigation) on its first step.
    expect(await screen.findByTestId('mint-thread')).toBeInTheDocument();
    expect(
      await screen.findByPlaceholderText('Describe the goal of this sub-task'),
    ).toBeInTheDocument();
  });
});
