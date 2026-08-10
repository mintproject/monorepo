/**
 * Hasura answers `delete_<table>_by_pk` with `null` when the row exists but the
 * role's delete permission filters it out. That is a 200 with no `errors` key,
 * so Apollo resolves and the caller reports success while the row is still
 * there. Issue #99 stayed invisible for exactly this reason.
 *
 * Call this on the `_by_pk` field of every delete so a filtered-out row raises
 * instead of passing.
 */
export function assertDeleted<T>(row: T | null | undefined, subject: string): T {
  if (row === null || row === undefined) {
    throw new Error(
      `${subject} was not deleted. The server accepted the request and removed no row, ` +
        `which usually means your account may not delete it.`,
    );
  }
  return row;
}
