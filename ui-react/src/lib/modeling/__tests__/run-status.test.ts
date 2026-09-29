import { describe, expect, it } from 'vitest';

import { aggregateRunStatus, normalizeRunStatus, stageStatusFromLegacyState } from '../run-status';

describe('run status normalization', () => {
  it.each([
    ['model_running', 'running'],
    ['output_registering', 'completing'],
    ['SUCCESS', 'completed'],
    ['timed_out', 'failed'],
    ['aborted', 'cancelled'],
    ['queued', 'waiting'],
    ['provider_added_a_new_state', 'unknown'],
  ] as const)('maps %s to %s', (raw, expected) => {
    expect(normalizeRunStatus(raw)).toBe(expected);
  });

  it('keeps legacy stage evidence explicit', () => {
    expect(stageStatusFromLegacyState('not-required')).toBe('not-required');
    expect(stageStatusFromLegacyState('pending')).toBe('waiting');
  });

  it('reports a completed aggregate only when all runs are successful', () => {
    expect(
      aggregateRunStatus({
        totalRuns: 2,
        submittedRuns: 2,
        successfulRuns: 2,
        failedRuns: 0,
      }),
    ).toBe('completed');
    expect(
      aggregateRunStatus({
        totalRuns: 2,
        submittedRuns: 2,
        successfulRuns: 1,
        failedRuns: 1,
      }),
    ).toBe('failed');
  });

  it('does not infer a successful run when evidence is incomplete', () => {
    expect(
      aggregateRunStatus({
        totalRuns: 2,
        submittedRuns: 1,
        successfulRuns: 1,
        failedRuns: 0,
      }),
    ).toBe('running');
    expect(
      aggregateRunStatus({
        totalRuns: 0,
        submittedRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
      }),
    ).toBe('unknown');
  });
});
