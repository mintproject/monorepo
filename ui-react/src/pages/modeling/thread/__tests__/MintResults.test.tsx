/**
 * Tests for MintResults — results browsing step.
 */
import { describe, expect, it, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils/render';
import { MintResults } from '../MintResults';
import type { ThreadExecutionData, ModelExecutionsMap } from '@/graphql/generated/execution';

// ─── Mock data ────────────────────────────────────────────────────────────────

const mockModel = {
  id: 'model-1',
  name: 'HydroModel',
  input_parameters: [
    { id: 'param-1', name: 'threshold', type: 'float', default: '5' },
  ],
  input_files: [],
  output_files: [
    { id: 'out-1', name: 'discharge_output', variables: ['streamflow'] },
  ],
};

const mockThreadDataNotSubmitted: ThreadExecutionData = {
  id: 'thread-1',
  models: { 'model-1': mockModel },
  model_ensembles: {
    'model-1': { id: 'ens-1', bindings: { 'param-1': ['5', '10'] } },
  },
  execution_summary: {
    'model-1': {
      total_runs: 2,
      submitted_runs: 0,
      failed_runs: 0,
      successful_runs: 0,
      // Not submitted yet
    },
  },
  data: {},
};

const mockThreadDataSubmitted: ThreadExecutionData = {
  id: 'thread-1',
  models: { 'model-1': mockModel },
  model_ensembles: {
    'model-1': { id: 'ens-1', bindings: { 'param-1': ['5', '10'] } },
  },
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
  data: {},
  response_variables: ['streamflow'],
};

const emptyExecutions: ModelExecutionsMap = {};
const loadingExecutions: ModelExecutionsMap = {
  'model-1': { executions: [], loading: true },
};
const executionsWithResults: ModelExecutionsMap = {
  'model-1': {
    loading: false,
    executions: [
      {
        id: 'exec-1',
        modelid: 'model-1',
        status: 'SUCCESS',
        bindings: { 'param-1': '5' },
        results: {
          'out-1': {
            id: 'out-1',
            name: 'discharge.nc',
            url: 'https://example.com/discharge.nc',
          },
        },
      },
    ],
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MintResults', () => {
  it('shows guard when runs are not submitted', () => {
    renderWithProviders(
      <MintResults
        threadData={mockThreadDataNotSubmitted}
        executions={emptyExecutions}
        canWrite
        ingestionApiAvailable={false}
        onContinue={vi.fn()}
        onFetchRuns={vi.fn()}
      />,
    );
    // Not submitted yet guard
    expect(screen.getByText(/please setup and run some models first/i)).toBeInTheDocument();
  });

  it('renders results heading when runs are submitted', () => {
    renderWithProviders(
      <MintResults
        threadData={mockThreadDataSubmitted}
        executions={emptyExecutions}
        canWrite
        ingestionApiAvailable={false}
        onContinue={vi.fn()}
        onFetchRuns={vi.fn()}
      />,
    );
    expect(screen.getByText(/Results/)).toBeInTheDocument();
  });

  it('renders the model name', () => {
    renderWithProviders(
      <MintResults
        threadData={mockThreadDataSubmitted}
        executions={emptyExecutions}
        canWrite
        ingestionApiAvailable={false}
        onContinue={vi.fn()}
        onFetchRuns={vi.fn()}
      />,
    );
    expect(screen.getByText('HydroModel')).toBeInTheDocument();
  });

  it('shows loading spinner when executions are loading', () => {
    renderWithProviders(
      <MintResults
        threadData={mockThreadDataSubmitted}
        executions={loadingExecutions}
        canWrite
        ingestionApiAvailable={false}
        onContinue={vi.fn()}
        onFetchRuns={vi.fn()}
      />,
    );
    const spinners = document.querySelectorAll('.animate-spin');
    expect(spinners.length).toBeGreaterThan(0);
  });

  it('renders the results table when executions have results', () => {
    renderWithProviders(
      <MintResults
        threadData={mockThreadDataSubmitted}
        executions={executionsWithResults}
        canWrite
        ingestionApiAvailable={false}
        onContinue={vi.fn()}
        onFetchRuns={vi.fn()}
      />,
    );
    expect(screen.getByTestId('results-table-model-1')).toBeInTheDocument();
  });

  it('renders output file links in the results table', () => {
    renderWithProviders(
      <MintResults
        threadData={mockThreadDataSubmitted}
        executions={executionsWithResults}
        canWrite
        ingestionApiAvailable={false}
        onContinue={vi.fn()}
        onFetchRuns={vi.fn()}
      />,
    );
    const link = screen.getByRole('link', { name: 'discharge.nc' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com/discharge.nc');
  });

  it('shows the Continue button', () => {
    renderWithProviders(
      <MintResults
        threadData={mockThreadDataSubmitted}
        executions={emptyExecutions}
        canWrite
        ingestionApiAvailable={false}
        onContinue={vi.fn()}
        onFetchRuns={vi.fn()}
      />,
    );
    expect(screen.getByTestId('results-continue-btn')).toBeInTheDocument();
  });

  it('calls onContinue when Continue is clicked', () => {
    const onContinue = vi.fn();
    renderWithProviders(
      <MintResults
        threadData={mockThreadDataSubmitted}
        executions={emptyExecutions}
        canWrite
        ingestionApiAvailable={false}
        onContinue={onContinue}
        onFetchRuns={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('results-continue-btn'));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('shows fetch results button when runs are finished', () => {
    const threadDataFinished: ThreadExecutionData = {
      ...mockThreadDataSubmitted,
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
    renderWithProviders(
      <MintResults
        threadData={threadDataFinished}
        executions={{ 'model-1': { executions: [], loading: false } }}
        canWrite
        ingestionApiAvailable={false}
        onContinue={vi.fn()}
        onFetchRuns={vi.fn()}
        onPublishResults={vi.fn()}
      />,
    );
    expect(screen.getByTestId('fetch-results-model-1')).toBeInTheDocument();
  });

  it('shows ingestion button when ingestion API is available and runs are finished', () => {
    const threadDataFinished: ThreadExecutionData = {
      ...mockThreadDataSubmitted,
      execution_summary: {
        'model-1': {
          total_runs: 2,
          submitted_runs: 2,
          failed_runs: 0,
          successful_runs: 2,
          submitted_for_execution: true,
        },
      },
    };
    renderWithProviders(
      <MintResults
        threadData={threadDataFinished}
        executions={{ 'model-1': { executions: [], loading: false } }}
        canWrite
        ingestionApiAvailable
        onContinue={vi.fn()}
        onFetchRuns={vi.fn()}
        onIngestResults={vi.fn()}
      />,
    );
    expect(screen.getByTestId('ingest-results-model-1')).toBeInTheDocument();
  });
});
