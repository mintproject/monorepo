import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';

import { renderWithProviders } from '@/test/utils/render';
import { RunDiagnosticsPage } from '../RunDiagnosticsPage';

const mocks = vi.hoisted(() => ({
  fetchRunHistoryDetail: vi.fn(),
}));

vi.mock('@/lib/ensemble-manager', () => ({
  ensembleManagerHeaders: vi.fn(() => ({ Authorization: 'Bearer test-token' })),
  fetchRunHistoryDetail: mocks.fetchRunHistoryDetail,
}));

const detail = {
  run_key: 'workflow-key',
  source: 'workflow' as const,
  run_kind: 'workflow_pipeline' as const,
  status: 'model_running',
  effective_started_at: '2026-09-24T12:00:00Z',
  started_at: '2026-09-24T12:00:00Z',
  ended_at: null,
  thread_id: 'thread-1',
  model_id: 'model-1',
  model_name: 'MODFLOW',
  execution_id: 'execution-1',
  model_child_id: 'model-child-1',
  parent_execution_id: null,
  plan_id: 'plan-1',
  provenance_completeness: 'complete' as const,
  warnings: [],
  schema_version: 1,
  identity: {
    execution_engine: 'tapis',
    source_id: 'execution-1',
    plan_hash: 'plan-hash',
    parameter_values_hash: 'values-hash',
  },
  model: { id: 'model-1', name: 'MODFLOW', configuration_id: 'configuration-1' },
  inputs: [],
  parameters: [],
  outputs: [],
  workflow: {
    adapter_steps: [],
    adapter_runs: [],
    stages: [],
  },
  artifacts: [],
  errors: [],
  status_history: [],
};

describe('RunDiagnosticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.__MINT_CONFIG__ = { ENSEMBLE_MANAGER_API: 'http://ensemble/v1' } as never;
    mocks.fetchRunHistoryDetail.mockResolvedValue(detail);
  });

  it('loads directly from the route and exposes technical provenance', async () => {
    renderWithProviders(
      <Routes>
        <Route
          path="/modeling/thread/:threadId/runs/:runKey/diagnostics"
          element={<RunDiagnosticsPage />}
        />
      </Routes>,
      {
        initialEntries: ['/modeling/thread/thread-1/runs/workflow-key/diagnostics'],
      },
    );

    expect(
      await screen.findByRole('heading', { name: 'Technical diagnostics' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Technical identifiers')).toBeInTheDocument();
    expect(screen.getByText('Raw workflow payload')).toBeInTheDocument();
    expect(screen.getAllByText('plan-hash').length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(mocks.fetchRunHistoryDetail).toHaveBeenCalledWith(
        'http://ensemble/v1',
        'thread-1',
        'workflow-key',
        expect.any(AbortSignal),
      ),
    );
  });

  it('surfaces a detail-load error without showing raw sections', async () => {
    mocks.fetchRunHistoryDetail.mockRejectedValueOnce(new Error('diagnostics unavailable'));

    renderWithProviders(
      <Routes>
        <Route
          path="/modeling/thread/:threadId/runs/:runKey/diagnostics"
          element={<RunDiagnosticsPage />}
        />
      </Routes>,
      {
        initialEntries: ['/modeling/thread/thread-1/runs/missing/diagnostics'],
      },
    );

    expect(await screen.findByText('diagnostics unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Raw workflow payload')).not.toBeInTheDocument();
  });
});
