import { gql, readClient } from './hasura/client.js'
import { authorizeCurator, RegionImportError } from './region-import.js'

const PARENT_CATEGORY_QUERY = gql`
  query RegionCategoryParent($id: String!) {
    region_category_by_pk(id: $id) {
      id
      name
      category_trees(limit: 1) {
        region_category_id
      }
    }
  }
`

const CREATE_CATEGORY_MUTATION = gql`
  mutation CreateRegionSubcategory(
    $id: String!
    $name: String!
    $citation: String
    $parentId: String!
  ) {
    insert_region_category_one(
      object: { id: $id, name: $name, citation: $citation }
    ) {
      id
      name
      citation
    }
    insert_region_category_tree_one(
      object: {
        region_category_id: $id
        region_category_parent_id: $parentId
      }
    ) {
      region_category_id
      region_category_parent_id
    }
  }
`

interface JsonObject {
  [key: string]: unknown
}

export interface RegionCategoryPayload {
  parent_category_id: string
  name: string
  citation?: string | null
}

export interface ValidatedRegionCategoryPayload {
  parent_category_id: string
  id: string
  name: string
  citation: string | null
}

/** Convert a display name into the stable ID used by the region category table. */
export function slugifyRegionCategory(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function validateRegionCategory(payload: unknown): ValidatedRegionCategoryPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new RegionImportError(400, 'Category payload must be an object')
  }

  const input = payload as JsonObject
  const parentCategoryId = typeof input.parent_category_id === 'string'
    ? input.parent_category_id.trim()
    : ''
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const citation = input.citation == null
    ? null
    : typeof input.citation === 'string'
      ? input.citation.trim() || null
      : null

  if (!parentCategoryId) {
    throw new RegionImportError(400, 'parent_category_id is required')
  }
  if (!name) throw new RegionImportError(400, 'Category name is required')
  if (name.length > 120) {
    throw new RegionImportError(400, 'Category name must be 120 characters or fewer')
  }
  if (input.citation != null && typeof input.citation !== 'string') {
    throw new RegionImportError(400, 'citation must be a string')
  }
  if (citation && citation.length > 2000) {
    throw new RegionImportError(400, 'Citation must be 2000 characters or fewer')
  }

  const id = slugifyRegionCategory(name)
  if (!id) throw new RegionImportError(400, 'Category name must contain a letter or number')

  return { parent_category_id: parentCategoryId, id, name, citation }
}

async function assertTopLevelParent(parentCategoryId: string): Promise<void> {
  const result = await readClient.query({
    query: PARENT_CATEGORY_QUERY,
    variables: { id: parentCategoryId },
    fetchPolicy: 'no-cache',
  })
  const parent = (result.data as JsonObject).region_category_by_pk as JsonObject | null
  if (!parent) throw new RegionImportError(400, 'Parent category does not exist')
  const parentEdges = parent.category_trees
  if (Array.isArray(parentEdges) && parentEdges.length > 0) {
    throw new RegionImportError(400, 'Subcategories can only be added under a top-level category')
  }
}

function sendRegionCategoryError(req: any, reply: any, error: unknown): void {
  if (error instanceof RegionImportError) {
    reply.code(error.statusCode).send({ error: error.message })
    return
  }
  req.log.error({ err: error }, 'Region category request failed')
  reply.code(502).send({ error: 'Region category write failed' })
}

export async function custom_regions_categories_post(req: any, reply: any): Promise<void> {
  try {
    await authorizeCurator(req)
    const payload = validateRegionCategory(req.body)
    await assertTopLevelParent(payload.parent_category_id)

    const result = await readClient.mutate({
      mutation: CREATE_CATEGORY_MUTATION,
      variables: {
        id: payload.id,
        name: payload.name,
        citation: payload.citation,
        parentId: payload.parent_category_id,
      },
    })
    const data = result.data as JsonObject | null
    const category = data?.insert_region_category_one as JsonObject | null
    if (!category) throw new Error('Category mutation returned no category')

    reply.code(201).send({
      id: category.id,
      name: category.name,
      citation: category.citation ?? null,
      parent_category_id: payload.parent_category_id,
    })
  } catch (error: any) {
    if (error instanceof RegionImportError) {
      sendRegionCategoryError(req, reply, error)
      return
    }
    const message = String(error?.message ?? '')
    req.log.error({ err: error }, 'Region category mutation failed')
    if (/duplicate|unique|already exists/i.test(message)) {
      reply.code(409).send({ error: 'A category with that name already exists' })
      return
    }
    sendRegionCategoryError(req, reply, error)
  }
}
