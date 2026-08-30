/**
 * Tests for MintRuns — execution lifecycle step.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils/render';
import { storeTokens } from '@/lib/auth/token-store';
import { MintRuns } from '../MintRuns';
import type { ThreadExecutionData, ModelExecutionsMap } from '@/graphql/generated/execution';

// ─── Mock data ────────────────────────────────────────────────────────────────

const mockModel = {
  id: 'model-1',
  name: 'FloodModel',
  input_parameters: [
    {
      id: 'param-1',
      name: 'flood_depth',
      type: 'float',
      default: '10',
    },
  ],
  input_files: [],
  output_files: [{ id: 'out-1', name: 'output_file' }],
};

const mockThreadData: ThreadExecutionData = {
  id: 'thread-1',
  models: { 'model-1': mockModel },
  model_ensembles: {
    'model-1': {
      id: 'ens-1',
      bindings: { 'param-1': ['10', '20'] },
    },
  },
  execution_summary: {
    'model-1': {
      total_runs: 2,
      submitted_runs: 0,
      failed_runs: 0,
      successful_runs: 0,
    },
  },
  data: {},
};

const mockThreadDataSubmitted: ThreadExecutionData = {
  ...mockThreadData,
  execution_summary: {
    'model-1': {
      total_runs: 2,
      submitted_runs: 2,
      failed_runs: 0,
      successful_runs: 2,
      submitted_for_execution: true,
      submission_time: '2024-01-01T00:00:00Z',
    },
  },
};

const noParamsDoneThread: ThreadExecutionData = {
  id: 'thread-2',
  models: { 'model-1': mockModel },
  model_ensembles: { 'model-1': { id: 'ens-1', bindings: {} } }, // no bindings
  execution_summary: {},
  data: {},
};

const emptyExecutions: ModelExecutionsMap = {};
const executionsWithOneRun: ModelExecutionsMap = {
  'model-1': {
    loading: false,
    executions: [
      {
        id: 'exec-1',
        modelid: 'model-1',
        status: 'SUCCESS',
        run_progress: 1,
        bindings: {},
        results: {},
      },
    ],
  },
};
const loadingExecutions: ModelExecutionsMap = {
  'model-1': { executions: [], loading: true },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MintRuns', () => {
  it('renders the guard message when params are not done', () => {
    renderWithProviders(
      <MintRuns
        threadData={noParamsDoneThread}
        executions={emptyExecutions}
        canWrite
        canExecute
        ensembleManagerApi="http://ensemble"
        onContinue={vi.fn()}
        onFetchRuns={vi.fn()}
        onSubmitRuns={vi.fn()}
      />,
    );
    expect(screen.getByText(/please setup some models first/i)).toBeInTheDocument();
  });

  it('renders the runs monitoring heading when params are done', () => {
    renderWithProviders(
      <MintRuns
        threadData={mockThreadData}
        executions={emptyExecutions}
        canWrite
        canExecute
        ensembleManagerApi="http://ensemble"
        onContinue={vi.fn()}
        onFetchRuns={vi.fn()}
        onSubmitRuns={vi.fn()}
      />,
    );
    expect(screen.getByText(/monitoring model runs/i)).toBeInTheDocument();
  });

  it('renders the model name in the runs list', () => {
    renderWithProviders(
      <MintRuns
        threadData={mockThreadData}
        executions={emptyExecutions}
        canWrite
        canExecute
        ensembleManagerApi="http://ensemble"
        onContinue={vi.fn()}
        onFetchRuns={vi.fn()}
        onSubmitRuns={vi.fn()}
      />,
    );
    expect(screen.getByText('FloodModel')).toBeInTheDocument();
  });

  it('shows Send Runs button when not yet submitted and user can execute', () => {
    renderWithProviders(
      <MintRuns
        threadData={mockThreadData}
        executions={emptyExecutions}
        canWrite
        canExecute
        ensembleManagerApi="http://ensemble"
        onContinue={vi.fn()}
        onFetchRuns={vi.fn()}
        onSubmitRuns={vi.fn()}
      />,
    );
    expect(screen.getByTestId('submit-runs-model-1')).toBeInTheDocument();
    expect(screen.getByText(/send runs/i)).toBeInTheDocument();
  });

  it('calls onSubmitRuns when Send Runs is clicked', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <MintRuns
        threadData={mockThreadData}
        executions={emptyExecutions}
        canWrite
        canExecute
        ensembleManagerApi="http://ensemble"
        onContinue={vi.fn()}
        onFetchRuns={vi.fn()}
        onSubmitRuns={onSubmit}
      />,
    );
    fireEvent.click(screen.getByTestId('submit-runs-model-1'));
    expect(onSubmit).toHaveBeenCalledWith('model-1');
  });

  it('shows loading spinner when executions are loading', () => {
    renderWithProviders(
      <MintRuns
        threadData={mockThreadDataSubmitted}
        executions={loadingExecutions}
        canWrite
        canExecute
        ensembleManagerApi="http://ensemble"
        onContinue={vi.fn()}
        onFetchRuns={vi.fn()}
        onSubmitRuns={vi.fn()}
      />,
    );
    // The runs table area should show a loading spinner (animated element)
    const spinners = document.querySelectorAll('.animate-spin');
    expect(spinners.length).toBeGreaterThan(0);
  });

  it('shows Continue button when all runs are done', () => {
    renderWithProviders(
      <MintRuns
        threadData={mockThreadDataSubmitted}
        executions={{
          'model-1': {
            executions: [],
            loading: false,
          },
        }}
        canWrite
        canExecute
        ensembleManagerApi="http://ensemble"
        onContinue={vi.fn()}
        onFetchRuns={vi.fn()}
        onSubmitRuns={vi.fn()}
      />,
    );
    expect(screen.getByTestId('runs-continue-btn')).toBeInTheDocument();
  });

  it('calls onContinue when Continue is clicked', () => {
    const onContinue = vi.fn();
    renderWithProviders(
      <MintRuns
        threadData={mockThreadDataSubmitted}
        executions={{ 'model-1': { executions: [], loading: false } }}
        canWrite
        canExecute
        ensembleManagerApi="http://ensemble"
        onContinue={onContinue}
        onFetchRuns={vi.fn()}
        onSubmitRuns={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('runs-continue-btn'));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('does not show Send Runs when canExecute=false', () => {
    renderWithProviders(
      <MintRuns
        threadData={mockThreadData}
        executions={emptyExecutions}
        canWrite={false}
        canExecute={false}
        ensembleManagerApi="http://ensemble"
        onContinue={vi.fn()}
        onFetchRuns={vi.fn()}
        onSubmitRuns={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('submit-runs-model-1')).not.toBeInTheDocument();
    expect(screen.getByText(/don't have permission/i)).toBeInTheDocument();
  });
});

// ─── Log fetch authentication ─────────────────────────────────────────────────
//
// Regression guard for #85: the log request read a localStorage key that nothing
// writes, so it went out with no Authorization header and failed silently. These
// assert the outgoing header, not the storage key — a key rename in token-store
// must not be able to break the call again.

describe('MintRuns log fetch authentication', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('log line') }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  function renderWithOneExecution() {
    renderWithProviders(
      <MintRuns
        threadData={mockThreadDataSubmitted}
        executions={executionsWithOneRun}
        canWrite
        canExecute
        ensembleManagerApi="http://ensemble"
        onContinue={vi.fn()}
        onFetchRuns={vi.fn()}
        onSubmitRuns={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /view log/i }));
  }

  function fetchInit(): RequestInit {
    const call = (globalThis.fetch as unknown as Mock).mock.calls[0] as [string, RequestInit];
    return call[1];
  }

  it('sends the stored access token as a Bearer header', async () => {
    storeTokens({ accessToken: 'stored-jwt' });
    renderWithOneExecution();

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledOnce());

    expect((globalThis.fetch as unknown as Mock).mock.calls[0]?.[0]).toBe(
      'http://ensemble/executions/exec-1/logs',
    );
    expect(fetchInit().headers).toMatchObject({ Authorization: 'Bearer stored-jwt' });
  });

  it('omits the Authorization header when no token is stored', async () => {
    renderWithOneExecution();

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledOnce());

    expect(fetchInit().headers).not.toHaveProperty('Authorization');
  });
});
