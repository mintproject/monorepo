import { afterEach, describe, expect, it, vi } from 'vitest';

import { recommendProblemStatement } from '../problemStatementRecommendations';

describe('recommendProblemStatement', () => {
  afterEach(() => vi.restoreAllMocks());

  it('posts a draft and returns the typed recommendation groups', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        capability: 'problem_statement_recommendations',
        status: 'ok',
        results: {
          svo: [{ id: 'sv-water', label: 'Water level', evidence: [] }],
          model_configuration: [{ id: 'model-1', label: 'MODFLOW', standard_variables: [] }],
        },
      }),
    } as Response);

    const result = await recommendProblemStatement({
      title: 'Understand groundwater availability',
      region_id: 'texas',
      start_date: '2000-01-01',
      end_date: '2020-01-01',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/problem-statements/recommendations'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.results.svo[0]?.label).toBe('Water level');
    expect(result.results.model_configuration[0]?.id).toBe('model-1');
  });

  it('rejects malformed responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    } as Response);

    await expect(recommendProblemStatement({ title: 'water' })).rejects.toThrow('invalid response');
  });
});
