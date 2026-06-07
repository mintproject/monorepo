/**
 * useRecentStandardVariables
 *
 * Remembers the last few standard variables the user picked, in a
 * localStorage-backed list (most-recent-first, capped, deduped by id).
 * Purely client-side; owns persistence only — no ranking logic.
 */
import * as React from 'react';

import type { StandardVariableOption } from '@/components/autocomplete/StandardVariableCombobox';

export const RECENT_STORAGE_KEY = 'mint.recentStandardVariables';
const MAX_RECENT = 5;

function readStored(): StandardVariableOption[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (o): o is StandardVariableOption =>
        typeof o === 'object' &&
        o !== null &&
        typeof (o as { id?: unknown }).id === 'string' &&
        typeof (o as { label?: unknown }).label === 'string',
    );
  } catch {
    return [];
  }
}

export function useRecentStandardVariables() {
  const [recent, setRecent] = React.useState<StandardVariableOption[]>(() => readStored());

  const recordUse = React.useCallback((option: StandardVariableOption) => {
    setRecent((prev) => {
      const next = [option, ...prev.filter((o) => o.id !== option.id)].slice(0, MAX_RECENT);
      try {
        localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota / serialization errors */
      }
      return next;
    });
  }, []);

  return { recent, recordUse };
}
