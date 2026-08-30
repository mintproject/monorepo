/**
 * Diffing the Models step's selection against the `thread_model` rows a thread
 * already holds.
 *
 * The Models step used to save by deleting every `thread_model` row for the
 * thread and re-inserting the selection. Four tables reference
 * `thread_model.id` with `ON DELETE RESTRICT` — `thread_model_execution_summary`,
 * `thread_model_execution`, `thread_model_io` and `thread_model_parameter` — so
 * once the thread had been through the Datasets or Parameters step, the delete
 * was refused and the step became a dead end (monorepo#107).
 *
 * The fix is to touch only what changed: keep the rows whose configuration is
 * still selected, delete the rows whose configuration is not, insert the rows
 * that are new. Keeping a row keeps its id, so the dataset and parameter
 * bindings hanging off it survive a trip back to the Models step.
 *
 * A row with no `modelcatalog_configuration_id` is left alone. The step cannot
 * display or select such a row, `threadModelFromGQL` skips it, and deleting it
 * would hit the same RESTRICT wall on any legacy thread that holds runs.
 * TACC's database holds 21 of them across 109 `thread_model` rows.
 */

/** The `thread_model` fields this module needs; `GetThread` selects both. */
export interface ExistingThreadModel {
  id: string;
  modelcatalog_configuration_id?: string | null;
}

export interface ThreadModelInsert {
  thread_id: string;
  modelcatalog_configuration_id: string;
}

export interface ThreadModelChanges {
  /** `thread_model.id` values to delete, with their bindings and runs. */
  removedIds: string[];
  /** Rows to insert for newly selected configurations. */
  added: ThreadModelInsert[];
  /** True when the selection matches what is stored, so no write is needed. */
  unchanged: boolean;
}

export function diffThreadModels(
  threadId: string,
  existing: readonly ExistingThreadModel[],
  selectedConfigIds: Iterable<string>,
): ThreadModelChanges {
  const selected = new Set(selectedConfigIds);
  const removedIds: string[] = [];
  const stored = new Set<string>();

  for (const row of existing) {
    const configId = row.modelcatalog_configuration_id;
    if (!configId) continue; // unselectable legacy row — leave it in place
    if (selected.has(configId)) stored.add(configId);
    else removedIds.push(row.id);
  }

  const added: ThreadModelInsert[] = [];
  for (const configId of selected) {
    if (!stored.has(configId)) {
      added.push({ thread_id: threadId, modelcatalog_configuration_id: configId });
    }
  }

  return {
    removedIds,
    added,
    unchanged: removedIds.length === 0 && added.length === 0,
  };
}
