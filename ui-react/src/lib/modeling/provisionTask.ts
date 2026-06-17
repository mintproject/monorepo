/**
 * Shared task + default-thread bootstrap for the modeling workflow.
 *
 * Both the problem-statement list (silent auto-provision when a problem
 * statement is created) and the detail page (manual "Add new task") need the
 * exact same sequence: create a task, a default thread under it, and a CREATE
 * provenance row for each. The thread CREATE provenance is REQUIRED — the
 * thread SELECT permission filters on events/permissions, so without it the new
 * sub-task is invisible to its own creator (returns null from thread_by_pk).
 */
import {
  generateModelingId,
  type InsertTaskMutationVariables,
  type InsertTaskProvenanceMutationVariables,
  type InsertThreadMutationVariables,
  type InsertThreadProvenanceMutationVariables,
} from '@/graphql/generated/modeling';

/** Apollo mutate functions accept `{ variables }` and resolve to a result. */
type Mutate<TVars> = (opts: { variables: TVars }) => Promise<unknown>;

export interface ProvisionTaskDeps {
  insertTask: Mutate<InsertTaskMutationVariables>;
  insertTaskProvenance: Mutate<InsertTaskProvenanceMutationVariables>;
  insertThread: Mutate<InsertThreadMutationVariables>;
  insertThreadProvenance: Mutate<InsertThreadProvenanceMutationVariables>;
}

export interface ProvisionTaskParams {
  problemStatementId: string;
  taskName: string;
  startDate: string;
  endDate: string;
  regionId: string | null;
  /** Current user; when absent, provenance writes are skipped. */
  userId?: string | null;
}

export interface ProvisionTaskResult {
  taskId: string;
  threadId: string;
}

export async function provisionTask(
  deps: ProvisionTaskDeps,
  params: ProvisionTaskParams,
): Promise<ProvisionTaskResult> {
  const { problemStatementId, taskName, startDate, endDate, regionId, userId } = params;

  const taskId = generateModelingId('task');
  await deps.insertTask({
    variables: {
      id: taskId,
      name: taskName,
      problemStatementId,
      startDate,
      endDate,
      regionId: regionId ?? null,
    },
  });
  if (userId) {
    await deps.insertTaskProvenance({
      variables: { taskId, event: 'CREATE', userid: userId },
    });
  }

  const threadId = generateModelingId('thread');
  await deps.insertThread({
    variables: {
      id: threadId,
      name: null,
      taskId,
      startDate,
      endDate,
      regionId: regionId ?? null,
    },
  });
  if (userId) {
    await deps.insertThreadProvenance({
      variables: { threadId, event: 'CREATE', userid: userId, notes: null },
    });
  }

  return { taskId, threadId };
}
