import { describe, expect, it } from 'vitest';

import {
  pickRecentProblemStatements,
  type ProblemStatementActivityRow,
} from '@/lib/modeling/recent-problem-statements';

function row(
  id: string | null,
  timestamp: string,
  name: string | null = null,
  regionId = 'ethiopia',
): ProblemStatementActivityRow {
  return {
    timestamp,
    problem_statement: id === null ? null : { id, name, region_id: regionId },
  };
}

describe('pickRecentProblemStatements', () => {
  it('returns nothing for an empty list', () => {
    expect(pickRecentProblemStatements([])).toEqual([]);
  });

  it('maps one activity row to one problem statement', () => {
    const result = pickRecentProblemStatements([
      row('ps1', '2026-08-30T10:00:00+00:00', 'Crop yield in the Awash basin'),
    ]);

    expect(result).toEqual([
      {
        id: 'ps1',
        name: 'Crop yield in the Awash basin',
        timestamp: '2026-08-30T10:00:00+00:00',
      },
    ]);
  });

  it('keeps only the newest activity for each problem statement', () => {
    const result = pickRecentProblemStatements([
      row('ps1', '2026-08-30T10:00:00+00:00', 'First'),
      row('ps1', '2026-08-29T10:00:00+00:00', 'First'),
      row('ps2', '2026-08-28T10:00:00+00:00', 'Second'),
    ]);

    expect(result.map((r) => r.id)).toEqual(['ps1', 'ps2']);
    expect(result[0]?.timestamp).toBe('2026-08-30T10:00:00+00:00');
  });

  it('orders by newest activity even when the rows arrive out of order', () => {
    const result = pickRecentProblemStatements([
      row('old', '2026-01-01T00:00:00+00:00', 'Old'),
      row('new', '2026-08-30T00:00:00+00:00', 'New'),
      row('mid', '2026-05-01T00:00:00+00:00', 'Mid'),
    ]);

    expect(result.map((r) => r.id)).toEqual(['new', 'mid', 'old']);
  });

  it('orders by instant, not by string, when offsets differ', () => {
    // 2026-08-30T01:00+02:00 is 23:00 on the 29th UTC -- earlier than
    // 2026-08-30T00:30Z, though it sorts later as a string.
    const result = pickRecentProblemStatements([
      row('offset', '2026-08-30T01:00:00+02:00', 'Offset'),
      row('utc', '2026-08-30T00:30:00+00:00', 'UTC'),
    ]);

    expect(result.map((r) => r.id)).toEqual(['utc', 'offset']);
  });

  it('drops rows whose problem statement the row-level filter hid', () => {
    const result = pickRecentProblemStatements([
      row(null, '2026-08-30T10:00:00+00:00'),
      row('ps1', '2026-08-29T10:00:00+00:00', 'Visible'),
    ]);

    expect(result.map((r) => r.id)).toEqual(['ps1']);
  });

  it('falls back to the id when the problem statement has no name', () => {
    expect(
      pickRecentProblemStatements([row('ps1', '2026-08-30T10:00:00+00:00', null)])[0]?.name,
    ).toBe('ps1');
    expect(
      pickRecentProblemStatements([row('ps2', '2026-08-30T10:00:00+00:00', '   ')])[0]?.name,
    ).toBe('ps2');
  });

  it('caps the result at the requested limit', () => {
    const rows = ['a', 'b', 'c', 'd', 'e'].map((id, i) =>
      row(id, `2026-08-0${i + 1}T00:00:00+00:00`, id.toUpperCase()),
    );

    expect(pickRecentProblemStatements(rows, 2)).toHaveLength(2);
  });

  it('defaults to at most three problem statements', () => {
    const rows = ['a', 'b', 'c', 'd', 'e'].map((id, i) =>
      row(id, `2026-08-0${i + 1}T00:00:00+00:00`, id.toUpperCase()),
    );

    expect(pickRecentProblemStatements(rows)).toHaveLength(3);
  });
});
