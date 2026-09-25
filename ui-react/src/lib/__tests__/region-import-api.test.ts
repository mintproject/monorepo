import { afterEach, describe, expect, it, vi } from 'vitest';

import { getRegionImportAccess, importRegions } from '@/lib/region-import-api';
import { setMintConfig } from '@/test/utils/mint-config';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('region import API', () => {
  it('checks curator access with the stored bearer token', async () => {
    setMintConfig({ MODEL_CATALOG_API: 'http://localhost:3002/v2.0.0/' });
    localStorage.setItem('mint.access_token', 'tok-123');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ allowed: true }), { status: 200 }));

    await expect(getRegionImportAccess()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3002/v2.0.0/regions/import/access', {
      headers: { Authorization: 'Bearer tok-123' },
    });
  });

  it('posts normalized regions without using the GraphQL client', async () => {
    setMintConfig({ MODEL_CATALOG_API: 'http://localhost:3002/v2.0.0' });
    localStorage.setItem('mint.access_token', 'tok-123');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ count: 1, regions: [{ id: 'one', name: 'One' }] }), {
        status: 201,
      }),
    );
    const payload = {
      parent_region_id: 'global',
      category_id: 'administrative',
      regions: [{ id: 'one', name: 'One', geometries: ['{"type":"Point","coordinates":[0,0]}'] }],
    };

    await expect(importRegions(payload)).resolves.toEqual({
      count: 1,
      regions: [{ id: 'one', name: 'One' }],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3002/v2.0.0/regions/import',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer tok-123',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }),
    );
  });

  it('does not make an anonymous request', async () => {
    setMintConfig({ MODEL_CATALOG_API: 'http://localhost:3002/v2.0.0' });
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    await expect(getRegionImportAccess()).rejects.toThrow(/authenticated/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
