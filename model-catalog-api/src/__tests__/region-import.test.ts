import { describe, expect, it } from 'vitest'

import {
  RegionImportError,
  regionImportBodyLimit,
  validateRegionImport,
} from '../region-import.js'
import { slugifyRegionCategory, validateRegionCategory } from '../region-category.js'

const polygon = JSON.stringify({
  type: 'Polygon',
  coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]],
})

describe('region import validation', () => {
  it('normalizes a valid import payload', () => {
    expect(validateRegionImport({
      parent_region_id: 'global',
      category_id: 'administrative',
      regions: [{ id: 'global__one', name: 'One', geometries: [polygon] }],
    })).toEqual({
      parent_region_id: 'global',
      category_id: 'administrative',
      regions: [{ id: 'global__one', name: 'One', geometries: [polygon] }],
    })
  })

  it('rejects duplicate IDs before the Hasura mutation', () => {
    expect(() => validateRegionImport({
      parent_region_id: 'global',
      category_id: 'administrative',
      regions: [
        { id: 'same', name: 'One', geometries: [polygon] },
        { id: 'same', name: 'Two', geometries: [polygon] },
      ],
    })).toThrowError(new RegionImportError(409, 'Duplicate region id: same'))
  })

  it('rejects malformed geometries', () => {
    expect(() => validateRegionImport({
      parent_region_id: 'global',
      category_id: 'administrative',
      regions: [{ id: 'bad', name: 'Bad', geometries: [{ type: 'Polygon', coordinates: [] }] }],
    })).toThrow('Geometry coordinates cannot be empty')
  })

  it('uses the configured request body limit', () => {
    const previous = process.env.REGION_IMPORT_BODY_LIMIT
    process.env.REGION_IMPORT_BODY_LIMIT = '1234'
    expect(regionImportBodyLimit()).toBe(1234)
    if (previous === undefined) delete process.env.REGION_IMPORT_BODY_LIMIT
    else process.env.REGION_IMPORT_BODY_LIMIT = previous
  })
})

describe('region category validation', () => {
  it('normalizes a subcategory name into a stable ID', () => {
    expect(validateRegionCategory({
      parent_category_id: 'hydrology',
      name: 'Aquifer GAMs',
      citation: 'TWDB',
    })).toEqual({
      parent_category_id: 'hydrology',
      id: 'aquifer_gams',
      name: 'Aquifer GAMs',
      citation: 'TWDB',
    })
  })

  it('rejects names that cannot produce a category ID', () => {
    expect(slugifyRegionCategory('---')).toBe('')
    expect(() => validateRegionCategory({
      parent_category_id: 'hydrology',
      name: '---',
    })).toThrowError(new RegionImportError(400, 'Category name must contain a letter or number'))
  })

  it('rejects an invalid citation type', () => {
    expect(() => validateRegionCategory({
      parent_category_id: 'hydrology',
      name: 'Aquifer GAMs',
      citation: 42,
    })).toThrowError(new RegionImportError(400, 'citation must be a string'))
  })
})
