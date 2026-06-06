/**
 * Tests for modeling utility functions in graphql/generated/modeling.ts.
 */
import { describe, expect, it } from 'vitest';
import {
  getUserPermission,
  getLatestEvent,
  getLatestEventOfType,
  generateModelingId,
  type ProblemStatementProvenance,
} from '@/graphql/generated/modeling';

// ─── getUserPermission ────────────────────────────────────────────────────────

describe('getUserPermission', () => {
  it('returns no access when currentUserId is null', () => {
    const result = getUserPermission([], [], null);
    expect(result).toEqual({ owner: false, write: false, read: false });
  });

  it('returns owner=true when user created the resource', () => {
    const events = [{ event: 'CREATE', userid: 'alice', timestamp: '2024-01-01' }];
    const result = getUserPermission([], events, 'alice');
    expect(result).toEqual({ owner: true, write: true, read: true });
  });

  it('returns write=true for wildcard write permission', () => {
    const permissions = [{ user_id: '*', read: true, write: true }];
    const events = [{ event: 'CREATE', userid: 'bob', timestamp: '2024-01-01' }];
    const result = getUserPermission(permissions, events, 'alice');
    expect(result).toEqual({ owner: false, write: true, read: true });
  });

  it('returns user-specific permission', () => {
    const permissions = [{ user_id: 'alice', read: true, write: false }];
    const events = [{ event: 'CREATE', userid: 'bob', timestamp: '2024-01-01' }];
    const result = getUserPermission(permissions, events, 'alice');
    expect(result).toEqual({ owner: false, write: false, read: true });
  });

  it('returns no access when user has no permissions', () => {
    const permissions = [{ user_id: 'carol', read: true, write: true }];
    const events = [{ event: 'CREATE', userid: 'bob', timestamp: '2024-01-01' }];
    const result = getUserPermission(permissions, events, 'alice');
    expect(result).toEqual({ owner: false, write: false, read: false });
  });

  it('handles undefined permissions gracefully', () => {
    const result = getUserPermission(undefined, undefined, 'alice');
    expect(result).toEqual({ owner: false, write: false, read: false });
  });
});

// ─── getLatestEvent ───────────────────────────────────────────────────────────

describe('getLatestEvent', () => {
  it('returns null for empty array', () => {
    expect(getLatestEvent([])).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(getLatestEvent(undefined)).toBeNull();
  });

  it('returns the event with the latest timestamp', () => {
    const events: ProblemStatementProvenance[] = [
      { event: 'CREATE', userid: 'alice', timestamp: '2024-01-01T00:00:00Z', notes: null },
      { event: 'UPDATE', userid: 'bob', timestamp: '2024-06-01T00:00:00Z', notes: null },
      { event: 'UPDATE', userid: 'carol', timestamp: '2024-03-01T00:00:00Z', notes: null },
    ];
    const result = getLatestEvent(events);
    expect(result?.userid).toBe('bob');
    expect(result?.event).toBe('UPDATE');
  });

  it('returns the single event when array has one item', () => {
    const events: ProblemStatementProvenance[] = [
      { event: 'CREATE', userid: 'alice', timestamp: '2024-01-01T00:00:00Z', notes: null },
    ];
    expect(getLatestEvent(events)?.userid).toBe('alice');
  });
});

// ─── getLatestEventOfType ─────────────────────────────────────────────────────

describe('getLatestEventOfType', () => {
  const events: ProblemStatementProvenance[] = [
    { event: 'CREATE', userid: 'alice', timestamp: '2024-01-01T00:00:00Z', notes: null },
    { event: 'UPDATE', userid: 'bob', timestamp: '2024-06-01T00:00:00Z', notes: 'note1' },
    { event: 'UPDATE', userid: 'carol', timestamp: '2024-03-01T00:00:00Z', notes: null },
  ];

  it('filters to the latest matching event', () => {
    const result = getLatestEventOfType(['UPDATE'], events);
    expect(result?.userid).toBe('bob');
  });

  it('returns null when no events match the type', () => {
    const result = getLatestEventOfType(['ADD_TASK'], events);
    expect(result).toBeNull();
  });

  it('handles CREATE type correctly', () => {
    const result = getLatestEventOfType(['CREATE'], events);
    expect(result?.userid).toBe('alice');
  });

  it('handles multiple types', () => {
    const result = getLatestEventOfType(['CREATE', 'UPDATE'], events);
    expect(result?.userid).toBe('bob');
  });
});

// ─── generateModelingId ───────────────────────────────────────────────────────

describe('generateModelingId', () => {
  it('generates a string starting with mint://', () => {
    const id = generateModelingId('problem_statement');
    expect(id).toMatch(/^mint:\/\/problem_statement\//);
  });

  it('generates different IDs on each call', () => {
    const id1 = generateModelingId('task');
    const id2 = generateModelingId('task');
    expect(id1).not.toBe(id2);
  });

  it('generates IDs for all supported types', () => {
    expect(generateModelingId('problem_statement')).toMatch(/problem_statement/);
    expect(generateModelingId('task')).toMatch(/task/);
    expect(generateModelingId('thread')).toMatch(/thread/);
  });
});
