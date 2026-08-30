/**
 * Standard Variable search + grouping.
 *
 * Pure helpers (no React) that rank options with match-sorter (label weighted
 * above description), compute highlight ranges, and assemble ordered display
 * groups with UUID demotion. Operates over the already-prefetched option list.
 */
import { matchSorter, rankings } from 'match-sorter';

import type { StandardVariableOption } from '@/components/autocomplete/StandardVariableCombobox';
import {
  CATEGORY_ORDER,
  deriveDisplayFields,
  type StandardVariableCategory,
  type StandardVariableDisplayFields,
} from '@/lib/standard-variable-taxonomy';

/** Group heading used for the recently-used pins. */
export const RECENT_GROUP_KEY = 'Recently used';

export interface DisplayStandardVariable
  extends StandardVariableOption, StandardVariableDisplayFields {}

export interface StandardVariableGroup {
  /** Category name, or RECENT_GROUP_KEY for the pinned recent group. */
  key: string;
  options: DisplayStandardVariable[];
}

export interface StandardVariableGroupResult {
  groups: StandardVariableGroup[];
  /** Distinct options matching the query (recent pins are not double-counted). */
  matchCount: number;
  /** Total options before filtering. */
  total: number;
}

/** Rank options by query. Empty query returns the input order unchanged.
 *
 * Two-pass strategy:
 *   1. Label-only pass (CONTAINS threshold) — these always rank above description matches.
 *   2. Description-only pass (WORD_STARTS_WITH threshold) — appended after label matches
 *      so a description hit can never outrank a label CONTAINS hit.
 */
export function rankStandardVariables(
  options: StandardVariableOption[],
  query: string,
): StandardVariableOption[] {
  const q = query.trim();
  if (q === '') return options;

  // Pass 1: items whose label contains the query.
  const labelMatches = matchSorter(options, q, {
    keys: ['label'],
    threshold: rankings.CONTAINS,
  });
  const labelMatchIds = new Set(labelMatches.map((o) => o.id));

  // Pass 2: remaining items whose description word-starts-with the query.
  const descMatches = matchSorter(options, q, {
    keys: [
      {
        key: (o: StandardVariableOption) => o.description ?? '',
        threshold: rankings.WORD_STARTS_WITH,
      },
    ],
  }).filter((o) => !labelMatchIds.has(o.id));

  return [...labelMatches, ...descMatches];
}

/** All case-insensitive highlight ranges for `text`, or [] if none / empty query. */
export function highlightRanges(text: string, query: string): Array<[number, number]> {
  const q = query.trim();
  if (q === '') return [];
  const haystack = text.toLowerCase();
  const needle = q.toLowerCase();
  const ranges: Array<[number, number]> = [];
  let from = 0;
  for (;;) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) break;
    ranges.push([idx, idx + needle.length]);
    from = idx + needle.length;
  }
  return ranges;
}

function toDisplay(option: StandardVariableOption): DisplayStandardVariable {
  return { ...option, ...deriveDisplayFields(option.label, option.description) };
}

/** Rank, group by category (canonical order), demote UUIDs, pin recents. */
export function buildStandardVariableGroups(
  options: StandardVariableOption[],
  recentIds: string[],
  query: string,
): StandardVariableGroupResult {
  const ranked = rankStandardVariables(options, query).map(toDisplay);
  const byId = new Map(ranked.map((o) => [o.id, o] as const));

  const recent = recentIds
    .map((id) => byId.get(id))
    .filter((o): o is DisplayStandardVariable => o !== undefined);

  const buckets = new Map<StandardVariableCategory, DisplayStandardVariable[]>();
  for (const o of ranked) {
    const arr = buckets.get(o.category);
    if (arr) arr.push(o);
    else buckets.set(o.category, [o]);
  }

  const groups: StandardVariableGroup[] = [];
  if (recent.length > 0) groups.push({ key: RECENT_GROUP_KEY, options: recent });
  for (const cat of CATEGORY_ORDER) {
    const arr = buckets.get(cat);
    if (arr && arr.length > 0) groups.push({ key: cat, options: arr });
  }

  return { groups, matchCount: ranked.length, total: options.length };
}
