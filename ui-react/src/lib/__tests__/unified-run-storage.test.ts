import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearUnifiedRunSnapshots,
  loadUnifiedRunSnapshot,
  saveUnifiedRunSnapshot,
} from '@/lib/unified-run-storage';
import type { UnifiedRunSnapshot } from '@/lib/ensemble-manager';

const snapshot = (runId: string, status: string): UnifiedRunSnapshot => ({
  run_id: runId,
  execution_mode: 'workflow_pipeline',
  status,
  adapter_runs: [{ run_id: `${runId}-adapter`, status }],
});

describe('unified workflow run storage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips the latest workflow snapshot', () => {
    const running = snapshot('ue_1', 'adapter_running');
    saveUnifiedRunSnapshot('alice', 'thread-1', 'model-1', running);

    expect(loadUnifiedRunSnapshot('alice', 'thread-1', 'model-1')).toEqual(running);
  });

  it('does not mix users, threads, or models', () => {
    const running = snapshot('ue_1', 'adapter_running');
    saveUnifiedRunSnapshot('alice', 'thread-1', 'model-1', running);

    expect(loadUnifiedRunSnapshot('bob', 'thread-1', 'model-1')).toBeNull();
    expect(loadUnifiedRunSnapshot('alice', 'thread-2', 'model-1')).toBeNull();
    expect(loadUnifiedRunSnapshot('alice', 'thread-1', 'model-2')).toBeNull();
  });

  it('keeps the newest snapshot active while retaining a prior run in the cache', () => {
    saveUnifiedRunSnapshot('alice', 'thread-1', 'model-1', snapshot('ue_1', 'failed'));
    const completed = snapshot('ue_2', 'model_succeeded');
    saveUnifiedRunSnapshot('alice', 'thread-1', 'model-1', completed);

    expect(loadUnifiedRunSnapshot('alice', 'thread-1', 'model-1')).toEqual(completed);
  });

  it('ignores ordinary model jobs and clears a cached pipeline on request', () => {
    saveUnifiedRunSnapshot('alice', 'thread-1', 'model-1', snapshot('job-1', 'SUCCESS'));
    expect(loadUnifiedRunSnapshot('alice', 'thread-1', 'model-1')).toBeNull();

    saveUnifiedRunSnapshot('alice', 'thread-1', 'model-1', snapshot('ue_1', 'running'));
    clearUnifiedRunSnapshots('alice', 'thread-1', 'model-1');
    expect(loadUnifiedRunSnapshot('alice', 'thread-1', 'model-1')).toBeNull();
  });

  it('treats malformed cache data as empty', () => {
    localStorage.setItem('mint.unified-workflow.v1.alice.thread-1.model-1', '{bad json');

    expect(loadUnifiedRunSnapshot('alice', 'thread-1', 'model-1')).toBeNull();
  });
});
