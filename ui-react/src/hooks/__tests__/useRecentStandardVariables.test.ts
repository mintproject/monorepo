import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { StandardVariableOption } from '@/components/autocomplete/StandardVariableCombobox';
import {
  RECENT_STORAGE_KEY,
  useRecentStandardVariables,
} from '@/hooks/useRecentStandardVariables';

const opt = (id: string): StandardVariableOption => ({ id, label: `${id}_label`, description: null });

afterEach(() => {
  localStorage.clear();
});

describe('useRecentStandardVariables', () => {
  it('starts empty when nothing is stored', () => {
    const { result } = renderHook(() => useRecentStandardVariables());
    expect(result.current.recent).toEqual([]);
  });

  it('records a use, most-recent-first, and persists', () => {
    const { result } = renderHook(() => useRecentStandardVariables());
    act(() => result.current.recordUse(opt('a')));
    act(() => result.current.recordUse(opt('b')));
    expect(result.current.recent.map((o) => o.id)).toEqual(['b', 'a']);
    expect(localStorage.getItem(RECENT_STORAGE_KEY)).toContain('"b"');
  });

  it('dedupes by id, moving the re-used item to the front', () => {
    const { result } = renderHook(() => useRecentStandardVariables());
    act(() => result.current.recordUse(opt('a')));
    act(() => result.current.recordUse(opt('b')));
    act(() => result.current.recordUse(opt('a')));
    expect(result.current.recent.map((o) => o.id)).toEqual(['a', 'b']);
  });

  it('caps at 5 entries', () => {
    const { result } = renderHook(() => useRecentStandardVariables());
    act(() => {
      ['a', 'b', 'c', 'd', 'e', 'f'].forEach((id) => result.current.recordUse(opt(id)));
    });
    expect(result.current.recent).toHaveLength(5);
    expect(result.current.recent.map((o) => o.id)).toEqual(['f', 'e', 'd', 'c', 'b']);
  });

  it('hydrates from existing storage', () => {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify([opt('x')]));
    const { result } = renderHook(() => useRecentStandardVariables());
    expect(result.current.recent.map((o) => o.id)).toEqual(['x']);
  });

  it('ignores malformed stored JSON', () => {
    localStorage.setItem(RECENT_STORAGE_KEY, '{not json');
    const { result } = renderHook(() => useRecentStandardVariables());
    expect(result.current.recent).toEqual([]);
  });
});
