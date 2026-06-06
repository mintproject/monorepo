import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { GetModelTreeQuery } from '@/graphql/generated/graphql';
import { useModelTree } from '@/hooks/useModelTree';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockData: GetModelTreeQuery = {
  modelcatalog_software: [
    {
      __typename: 'modelcatalog_software',
      id: 'sw1',
      label: 'PIHM',
      versions: [
        {
          __typename: 'modelcatalog_software_version',
          id: 'ver1',
          label: 'v2.2',
          version_id: '2.2',
          configurations: [
            {
              __typename: 'modelcatalog_configuration',
              id: 'cfg1',
              label: 'Default Config',
              child_configurations: [
                {
                  __typename: 'modelcatalog_configuration',
                  id: 'setup1',
                  label: 'Ethiopia Setup',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      __typename: 'modelcatalog_software',
      id: 'sw2',
      label: 'CYCLES',
      versions: [],
    },
  ],
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useModelTree', () => {
  it('returns empty nodes when data is undefined', () => {
    const { result } = renderHook(() => useModelTree(undefined));
    expect(result.current.nodes).toHaveLength(0);
  });

  it('builds tree from query data', () => {
    const { result } = renderHook(() => useModelTree(mockData));
    expect(result.current.nodes).toHaveLength(2);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const node0 = result.current.nodes[0]!;
    expect(node0.label).toBe('PIHM');
    expect(node0.entityType).toBe('software');
    expect(node0.children).toHaveLength(1);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const ver = node0.children[0]!;
    expect(ver.entityType).toBe('version');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const cfg = ver.children[0]!;
    expect(cfg.entityType).toBe('config');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const setup = cfg.children[0]!;
    expect(setup.entityType).toBe('setup');
  });

  it('nodeId is scoped by entity type to avoid collisions', () => {
    const { result } = renderHook(() => useModelTree(mockData));
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const sw = result.current.nodes[0]!;
    expect(sw.nodeId).toBe('software:sw1');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const ver = sw.children[0]!;
    expect(ver.nodeId).toBe('version:ver1');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const cfg = ver.children[0]!;
    expect(cfg.nodeId).toBe('config:cfg1');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const setup = cfg.children[0]!;
    expect(setup.nodeId).toBe('setup:setup1');
  });

  it('starts with no nodes expanded', () => {
    const { result } = renderHook(() => useModelTree(mockData));
    expect(result.current.expandedIds.size).toBe(0);
  });

  it('toggleExpanded adds and removes a nodeId', () => {
    const { result } = renderHook(() => useModelTree(mockData));

    act(() => {
      result.current.toggleExpanded('software:sw1');
    });
    expect(result.current.isExpanded('software:sw1')).toBe(true);

    act(() => {
      result.current.toggleExpanded('software:sw1');
    });
    expect(result.current.isExpanded('software:sw1')).toBe(false);
  });

  it('collapseAll clears expanded set', () => {
    const { result } = renderHook(() => useModelTree(mockData));

    act(() => {
      result.current.toggleExpanded('software:sw1');
      result.current.toggleExpanded('version:ver1');
    });
    expect(result.current.expandedIds.size).toBe(2);

    act(() => {
      result.current.collapseAll();
    });
    expect(result.current.expandedIds.size).toBe(0);
  });

  it('expandAll sets provided nodeIds', () => {
    const { result } = renderHook(() => useModelTree(mockData));

    act(() => {
      result.current.expandAll(['software:sw1', 'version:ver1']);
    });
    expect(result.current.isExpanded('software:sw1')).toBe(true);
    expect(result.current.isExpanded('version:ver1')).toBe(true);
    expect(result.current.isExpanded('config:cfg1')).toBe(false);
  });

  describe('search filtering', () => {
    it('shows all nodes when searchTerm is empty', () => {
      const { result } = renderHook(() => useModelTree(mockData));
      expect(result.current.nodes).toHaveLength(2);
    });

    it('filters nodes by label (case-insensitive)', () => {
      const { result } = renderHook(() => useModelTree(mockData));

      act(() => {
        result.current.setSearchTerm('cycles');
      });
      // Only CYCLES should survive
      expect(result.current.nodes).toHaveLength(1);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(result.current.nodes[0]!.label).toBe('CYCLES');
    });

    it('keeps ancestors of matching descendants', () => {
      const { result } = renderHook(() => useModelTree(mockData));

      act(() => {
        result.current.setSearchTerm('Ethiopia');
      });
      // PIHM > v2.2 > Default Config > Ethiopia Setup — all four levels kept
      expect(result.current.nodes).toHaveLength(1);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(result.current.nodes[0]!.label).toBe('PIHM');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const ver = result.current.nodes[0]!.children[0]!;
      expect(ver.label).toContain('v2.2');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const cfg = ver.children[0]!;
      expect(cfg.label).toBe('Default Config');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const setup = cfg.children[0]!;
      expect(setup.label).toBe('Ethiopia Setup');
    });

    it('auto-expands matching nodes when a search term is set', () => {
      const { result } = renderHook(() => useModelTree(mockData));

      act(() => {
        result.current.setSearchTerm('Ethiopia');
      });
      // software, version, config, and setup should all be expanded
      expect(result.current.isExpanded('software:sw1')).toBe(true);
      expect(result.current.isExpanded('version:ver1')).toBe(true);
    });

    it('collapses all and resets filter when search term is cleared', () => {
      const { result } = renderHook(() => useModelTree(mockData));

      act(() => {
        result.current.setSearchTerm('Ethiopia');
      });
      act(() => {
        result.current.setSearchTerm('');
      });
      expect(result.current.nodes).toHaveLength(2);
      expect(result.current.expandedIds.size).toBe(0);
    });
  });
});
