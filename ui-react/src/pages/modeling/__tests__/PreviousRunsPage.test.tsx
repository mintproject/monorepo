import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';

import { renderWithProviders } from '@/test/utils/render';
import { PreviousRunsPage } from '../PreviousRunsPage';

const mocks = vi.hoisted(() => ({
  fetchRunHistory: vi.fn(),
  fetchRunHistoryDetail: vi.fn(),
}));

vi.mock('@/lib/ensemble-manager', () => ({
  ensembleManagerHeaders: vi.fn(() => ({ Authorization: 'Bearer test-token' })),
  fetchRunHistory: mocks.fetchRunHistory,
  fetchRunHistoryDetail: mocks.fetchRunHistoryDetail,
}));

const summary = {
  run_key: 'legacy-key',
  source: 'legacy_execution' as const,
  run_kind: 'legacy_model_job' as const,
  status: 'SUCCESS',
  effective_started_at: '2026-09-24T12:00:00Z',
  started_at: '2026-09-24T12:00:00Z',
  ended_at: '2026-09-24T12:01:00Z',
  thread_id: 'thread-1',
  model_id: 'model-1',
  model_name: 'MODFLOW',
  execution_id: 'execution-1',
  model_child_id: null,
  parent_execution_id: null,
  plan_id: null,
  provenance_completeness: 'partial' as const,
  warnings: ['Legacy execution has no recorded workflow stages.'],
};

describe('PreviousRunsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchRunHistory.mockResolvedValue({
      schema_version: 1,
      runs: [summary],
      next_cursor: null,
    });
    mocks.fetchRunHistoryDetail.mockResolvedValue({
      ...summary,
      schema_version: 1,
      identity: {
        execution_engine: 'tapis',
        source_id: 'execution-1',
        plan_hash: null,
        parameter_values_hash: null,
      },
      model: { id: 'model-1', name: 'MODFLOW', configuration_id: 'model-1' },
      inputs: [],
      parameters: [{ parameter_id: 'well_rate', requested_value: '1', executed_value: '1' }],
      outputs: [],
      workflow: null,
      artifacts: [],
      errors: [],
      status_history: [
        { status: 'SUCCESS', observed_at: summary.started_at, source: 'legacy_execution' },
      ],
    });
  });

  it('loads a server-owned legacy run and explains the missing workflow stages', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/modeling/thread/:id/runs" element={<PreviousRunsPage />} />
      </Routes>,
      { initialEntries: ['/modeling/thread/thread-1/runs'] },
    );

    expect(await screen.findByText('Previous runs & provenance')).toBeInTheDocument();
    expect((await screen.findAllByText('MODFLOW')).length).toBeGreaterThan(0);
    expect(
      await screen.findByText(/legacy model job has no recorded workflow stages/i),
    ).toBeInTheDocument();
    expect(screen.getByText('well_rate')).toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.fetchRunHistoryDetail).toHaveBeenCalledWith(
        '',
        'thread-1',
        'legacy-key',
        expect.any(AbortSignal),
      ),
    );
  });

  it('opens an artifact through an authenticated request', async () => {
    window.__MINT_CONFIG__ = { ENSEMBLE_MANAGER_API: 'http://ensemble/v1' } as never;
    mocks.fetchRunHistoryDetail.mockResolvedValueOnce({
      ...summary,
      schema_version: 1,
      identity: {
        execution_engine: 'tapis',
        source_id: 'execution-1',
        plan_hash: null,
        parameter_values_hash: null,
      },
      model: { id: 'model-1', name: 'MODFLOW', configuration_id: 'model-1' },
      inputs: [],
      parameters: [],
      outputs: [],
      workflow: null,
      artifacts: [
        {
          kind: 'archived_files',
          provider: 'ensemble_manager',
          source_id: 'execution-1',
          endpoint: '/executions/execution-1/files',
          availability: 'available',
        },
      ],
      errors: [],
      status_history: [],
    });
    const popup = { location: { href: '' }, close: vi.fn() } as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValue(popup);
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn().mockReturnValue('blob:test'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        blob: () => Promise.resolve(new Blob(['{"files":[]}'], { type: 'application/json' })),
      }),
    );

    renderWithProviders(
      <Routes>
        <Route path="/modeling/thread/:id/runs" element={<PreviousRunsPage />} />
      </Routes>,
      { initialEntries: ['/modeling/thread/thread-1/runs'] },
    );

    await userEvent.click(await screen.findByRole('link', { name: 'archived_files' }));
    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://ensemble/v1/executions/execution-1/files',
        { headers: { Authorization: 'Bearer test-token' } },
      ),
    );
    expect(popup.location.href).toMatch(/^blob:/);
  });
});
