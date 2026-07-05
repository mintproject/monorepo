/**
 * Variable catalog search.
 *
 * Pure helper that ranks standard-variable rows for the /variables catalog.
 * Reuses `rankStandardVariables` (label CONTAINS above description
 * WORD_STARTS_WITH) and folds unit-label matches into the same search path:
 * a row whose unit label matches the query (but whose name/description do not)
 * is appended after the name/description matches, so typing a unit surfaces the
 * variables available in that unit.
 */
import { rankStandardVariables } from '@/lib/standard-variable-search';

export interface VariableSearchRow {
  id: string;
  label?: string | null;
  description?: string | null;
  units: { id: string; label: string }[];
}

/** Deduped searchable unit-label list for a row (order preserved). */
export function unitLabels(row: VariableSearchRow): string[] {
  return row.units.map((u) => u.label);
}

/**
 * Rank rows by relevance to `query`. Name matches rank above description
 * matches (via `rankStandardVariables`); rows matching only on a unit label are
 * appended after. An empty query returns the input order unchanged.
 */
export function searchVariableRows<T extends VariableSearchRow>(rows: T[], query: string): T[] {
  const q = query.trim();
  if (q === '') return rows;

  const byId = new Map(rows.map((r) => [r.id, r] as const));
  const options = rows.map((r) => ({
    id: r.id,
    label: r.label ?? '',
    description: r.description ?? null,
  }));

  const result: T[] = [];
  const seen = new Set<string>();
  for (const option of rankStandardVariables(options, q)) {
    const row = byId.get(option.id);
    if (row) {
      result.push(row);
      seen.add(row.id);
    }
  }

  const needle = q.toLowerCase();
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    if (unitLabels(row).some((label) => label.toLowerCase().includes(needle))) {
      result.push(row);
      seen.add(row.id);
    }
  }

  return result;
}
