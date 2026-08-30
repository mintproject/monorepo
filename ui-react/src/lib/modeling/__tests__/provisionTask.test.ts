/**
 * Tests for provisionTask — the shared task+thread bootstrap used by both the
 * problem-statement list (auto-provision on create) and the detail page
 * (manual "Add new task").
 */
import { describe, expect, it, vi } from 'vitest';

import { provisionTask } from '../provisionTask';

function makeDeps() {
  return {
    insertTask: vi.fn().mockResolvedValue({}),
    insertTaskProvenance: vi.fn().mockResolvedValue({}),
    insertThread: vi.fn().mockResolvedValue({}),
    insertThreadProvenance: vi.fn().mockResolvedValue({}),
  };
}

describe('provisionTask', () => {
  it('creates a task and a default thread, each with a CREATE provenance', async () => {
    const deps = makeDeps();

    const result = await provisionTask(deps, {
      problemStatementId: 'ps-1',
      taskName: 'My task',
      startDate: '2000-01-01',
      endDate: '2020-01-01',
      regionId: 'south_sudan',
      userId: 'testuser',
    });

    // Task insert with the generated id, name, dates, region.
    expect(deps.insertTask).toHaveBeenCalledTimes(1);
    const taskVars = deps.insertTask.mock.calls[0]![0].variables;
    expect(taskVars).toMatchObject({
      id: result.taskId,
      name: 'My task',
      problemStatementId: 'ps-1',
      startDate: '2000-01-01',
      endDate: '2020-01-01',
      regionId: 'south_sudan',
    });

    // Task CREATE provenance for the same task id.
    expect(deps.insertTaskProvenance).toHaveBeenCalledTimes(1);
    expect(deps.insertTaskProvenance.mock.calls[0]![0].variables).toMatchObject({
      taskId: result.taskId,
      event: 'CREATE',
      userid: 'testuser',
    });

    // Default thread (name null) under the new task.
    expect(deps.insertThread).toHaveBeenCalledTimes(1);
    const threadVars = deps.insertThread.mock.calls[0]![0].variables;
    expect(threadVars).toMatchObject({
      id: result.threadId,
      name: null,
      taskId: result.taskId,
      startDate: '2000-01-01',
      endDate: '2020-01-01',
      regionId: 'south_sudan',
    });

    // Thread CREATE provenance — required for the creator to see the thread.
    expect(deps.insertThreadProvenance).toHaveBeenCalledTimes(1);
    expect(deps.insertThreadProvenance.mock.calls[0]![0].variables).toMatchObject({
      threadId: result.threadId,
      event: 'CREATE',
      userid: 'testuser',
    });
  });

  it('skips provenance writes when there is no user id', async () => {
    const deps = makeDeps();

    await provisionTask(deps, {
      problemStatementId: 'ps-1',
      taskName: 'Anon task',
      startDate: '2000-01-01',
      endDate: '2020-01-01',
      regionId: null,
      userId: null,
    });

    expect(deps.insertTask).toHaveBeenCalledTimes(1);
    expect(deps.insertThread).toHaveBeenCalledTimes(1);
    expect(deps.insertTaskProvenance).not.toHaveBeenCalled();
    expect(deps.insertThreadProvenance).not.toHaveBeenCalled();
  });
});
