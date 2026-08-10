import { describe, it, expect } from 'vitest';
import { assertDeleted } from '@/lib/modeling/assertDeleted';

/**
 * #99: Hasura answers `delete_*_by_pk` with `null` when the row exists but the
 * role's delete permission filters it out, and sends no `errors` key with it.
 * That is what let a failed delete render as "Problem statement deleted".
 */
describe('assertDeleted', () => {
  it('throws on null — a filtered-out row, which Hasura reports as success', () => {
    expect(() => assertDeleted(null, 'Problem statement')).toThrow(/was not deleted/);
  });

  it('throws on undefined — the field missing from a partial response', () => {
    expect(() => assertDeleted(undefined, 'Task')).toThrow(/was not deleted/);
  });

  it('names the subject, so the toast says what survived', () => {
    expect(() => assertDeleted(null, 'Sub-task')).toThrow(/^Sub-task /);
  });

  it('returns the row when one was deleted', () => {
    const row = { id: 'abc' };
    expect(assertDeleted(row, 'Task')).toBe(row);
  });

  it('accepts a falsy row that is not null — 0 rows is the only failure', () => {
    expect(assertDeleted(0, 'Task')).toBe(0);
    expect(assertDeleted('', 'Task')).toBe('');
  });
});
