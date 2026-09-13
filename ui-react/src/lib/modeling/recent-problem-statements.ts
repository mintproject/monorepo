/**
 * Reduce a user's problem-statement provenance feed to the handful of problem
 * statements they touched most recently.
 *
 * The feed is one row per event, so the same problem statement appears many
 * times. Hasura's row-level filter also nulls out the `problem_statement`
 * relationship for any event whose statement the user may no longer read, so a
 * row can arrive without the thing it points at.
 */

export interface ProblemStatementActivityRow {
  timestamp: string;
  problem_statement?: {
    id: string;
    name?: string | null;
    region_id: string;
  } | null;
}

export interface RecentProblemStatement {
  id: string;
  /** The statement's name, or its id when the name is missing or blank. */
  name: string;
  /** Timestamp of the most recent event on this statement. */
  timestamp: string;
}

const DEFAULT_LIMIT = 3;

/**
 * Compare two `timestamptz` values as instants.
 *
 * Hasura writes UTC today, so comparing the raw strings would work -- until a
 * client writes a local offset, at which point lexical order stops matching
 * chronological order.
 */
function instant(timestamp: string): number {
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? -Infinity : parsed;
}

export function pickRecentProblemStatements(
  rows: ProblemStatementActivityRow[],
  limit: number = DEFAULT_LIMIT,
): RecentProblemStatement[] {
  const newestById = new Map<string, RecentProblemStatement>();

  for (const row of rows) {
    const statement = row.problem_statement;
    if (!statement) continue;

    const existing = newestById.get(statement.id);
    if (existing && instant(existing.timestamp) >= instant(row.timestamp)) continue;

    newestById.set(statement.id, {
      id: statement.id,
      name: statement.name?.trim() ? statement.name.trim() : statement.id,
      timestamp: row.timestamp,
    });
  }

  return Array.from(newestById.values())
    .sort((a, b) => instant(b.timestamp) - instant(a.timestamp))
    .slice(0, limit);
}
