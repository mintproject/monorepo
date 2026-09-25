import { afterEach, describe, expect, it, vi } from 'vitest';

import { createRegionSubcategory } from '@/lib/region-category-api';
import { setMintConfig } from '@/test/utils/mint-config';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('region category API', () => {
  it('creates a subcategory with the stored bearer token', async () => {
    setMintConfig({ MODEL_CATALOG_API: 'http://localhost:3002/v2.0.0/' });
    localStorage.setItem('mint.access_token', 'tok-123');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'aquifer_gams',
          name: 'Aquifer GAMs',
          citation: null,
          parent_category_id: 'hydrology',
        }),
        { status: 201 },
      ),
    );

    await expect(
      createRegionSubcategory({
        parent_category_id: 'hydrology',
        name: 'Aquifer GAMs',
      }),
    ).resolves.toMatchObject({ id: 'aquifer_gams', name: 'Aquifer GAMs' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3002/v2.0.0/regions/categories',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer tok-123',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ parent_category_id: 'hydrology', name: 'Aquifer GAMs' }),
      }),
    );
  });

  it('does not make an anonymous request', async () => {
    setMintConfig({ MODEL_CATALOG_API: 'http://localhost:3002/v2.0.0' });
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    await expect(
      createRegionSubcategory({ parent_category_id: 'hydrology', name: 'Aquifer GAMs' }),
    ).rejects.toThrow(/authenticated/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
