import { describe, it, expect } from 'vitest';
import { print, type DocumentNode } from 'graphql';
import {
  DeleteProblemStatementDocument,
  DeleteTaskDocument,
  DeleteThreadDocument,
} from '@/graphql/generated/modeling';

/**
 * Regression guard for #99.
 *
 * The `user` role may delete a problem statement, a task or a thread only while
 * the row still carries a CREATE provenance event from that user. Every child
 * delete on the tree is gated the same way, through the thread's provenance or
 * permission rows.
 *
 * These documents used to delete the provenance and permission rows first —
 * copied verbatim from the Lit app, which has the same bug. That revoked the
 * permission for everything after it, so all eleven root fields matched 0 rows.
 * Hasura returns `null` from `delete_*_by_pk` for a filtered-out row, with no
 * `errors` key, so the app reported a successful delete over an intact tree.
 *
 * The other order does not work either: the provenance and permission FKs were
 * `ON DELETE RESTRICT`, so deleting the row first was refused by Postgres. Both
 * orders were proven to fail against the dev cluster's database. The fix is the
 * migration `1771200017000_modeling_provenance_cascade_on_delete`, which makes
 * those six FKs `ON DELETE CASCADE` so the client never deletes them at all.
 */

const DOCUMENTS: Array<[string, DocumentNode]> = [
  ['DeleteProblemStatement', DeleteProblemStatementDocument],
  ['DeleteTask', DeleteTaskDocument],
  ['DeleteThread', DeleteThreadDocument],
];

/** Root field names, in document order. */
function rootFields(doc: DocumentNode): string[] {
  const names: string[] = [];
  for (const def of doc.definitions) {
    if (def.kind !== 'OperationDefinition') continue;
    for (const sel of def.selectionSet.selections) {
      if (sel.kind === 'Field') names.push(sel.name.value);
    }
  }
  return names;
}

describe.each(DOCUMENTS)('%s', (name, doc) => {
  const fields = rootFields(doc);

  it('deletes no provenance row — those cascade off the row they authorise', () => {
    expect(fields.filter((f) => f.endsWith('_provenance'))).toEqual([]);
  });

  it('deletes no permission row — those cascade too', () => {
    expect(fields.filter((f) => f.endsWith('_permission'))).toEqual([]);
  });

  it('ends on the _by_pk delete, so the caller can tell 0 rows from 1', () => {
    expect(fields.at(-1)).toMatch(/^delete_[a-z_]+_by_pk$/);
  });

  it('deletes dataslice before thread_data, which its permission filter reads', () => {
    // `dataslice`'s user-role delete filter walks dataslice -> thread_data ->
    // thread. Removing thread_data first would leave every dataslice
    // unmatchable, and thread_data.dataslice_id would then block the delete.
    const dataslice = fields.indexOf('delete_dataslice');
    const threadData = fields.indexOf('delete_thread_data');
    expect(dataslice).toBeGreaterThanOrEqual(0);
    expect(threadData).toBeGreaterThan(dataslice);
  });

  it('deletes dataslice_resource before dataslice, which it references', () => {
    const resource = fields.indexOf('delete_dataslice_resource');
    expect(resource).toBeGreaterThanOrEqual(0);
    expect(fields.indexOf('delete_dataslice')).toBeGreaterThan(resource);
  });

  it('deletes thread_model last of the thread_model_* rows that reference it', () => {
    const threadModel = fields.indexOf('delete_thread_model');
    expect(threadModel).toBeGreaterThanOrEqual(0);
    for (const dependant of fields.filter((f) => f.startsWith('delete_thread_model_'))) {
      expect(fields.indexOf(dependant)).toBeLessThan(threadModel);
    }
  });

  it(`names ${name} so the operation name stays stable for the caller`, () => {
    expect(print(doc)).toContain(`mutation ${name}(`);
  });
});

describe('DeleteProblemStatement', () => {
  const fields = rootFields(DeleteProblemStatementDocument);

  it('deletes threads, then tasks, then the problem statement', () => {
    expect(fields.indexOf('delete_thread')).toBeLessThan(fields.indexOf('delete_task'));
    expect(fields.indexOf('delete_task')).toBeLessThan(
      fields.indexOf('delete_problem_statement_by_pk'),
    );
  });
});
