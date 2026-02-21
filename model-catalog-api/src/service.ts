/**
 * Generic CRUD service for all 46 API resource types.
 *
 * fastify-openapi-glue calls service[operationId](req, reply) for each request.
 * A JavaScript Proxy intercepts these calls, parses the operationId to extract
 * the resource name and operation, then dispatches to a generic handler.
 *
 * This replaces 230+ individual handler files with a single class.
 */

import { randomUUID } from 'crypto'
import { RESOURCE_REGISTRY, getResourceConfig } from './mappers/resource-registry.js'
import { transformRow, transformList } from './mappers/response.js'
import { toHasuraInput } from './mappers/request.js'
import { readClient, getWriteClient, gql } from './hasura/client.js'
import type { ResourceConfig } from './mappers/resource-registry.js'

const ID_PREFIX = 'https://w3id.org/okn/i/mint/'

/**
 * Build a GraphQL field selection string for a resource, including
 * all scalar columns and first-level relationship sub-selections.
 *
 * Hasura row fields are always scalar by default; we enumerate relationship
 * names from the resource config so Hasura returns them in the query result.
 */
function buildFieldSelection(resourceConfig: ResourceConfig, depth = 0): string {
  const relHasuraNames = Object.values(resourceConfig.relationships).map((r) => r.hasuraRelName)

  // Base scalar selection -- we request all columns via `id` plus a broad set.
  // Hasura ignores columns that don't exist, so listing common fields is safe.
  // We also request relationship sub-selections so nested objects come back.
  let fields = 'id label description has_documentation date_created date_modified user_id'

  // Add resource-specific relationship sub-selections (depth guard)
  if (depth < 1) {
    for (const [, relConfig] of Object.entries(resourceConfig.relationships)) {
      const targetConfig = RESOURCE_REGISTRY[relConfig.targetResource]
      if (targetConfig && relConfig.type === 'object') {
        fields += ` ${relConfig.hasuraRelName} { id label }`
      } else if (targetConfig && relConfig.type === 'array') {
        fields += ` ${relConfig.hasuraRelName} { id label }`
      } else {
        fields += ` ${relConfig.hasuraRelName} { id }`
      }
    }
  }

  // Avoid unused variable warning
  void relHasuraNames

  return fields
}

/**
 * Build where clause for software subtype filtering.
 * Software subtypes (models, emulators, etc.) share the modelcatalog_software table.
 * The type is stored in a `type` column in Hasura.
 */
function getSoftwareTypeFilter(resource: string): string | null {
  const SUBTYPE_MAP: Record<string, string> = {
    models: 'https://w3id.org/okn/o/sdm#Model',
    empiricalmodels: 'https://w3id.org/okn/o/sdm#EmpiricalModel',
    hybridmodels: 'https://w3id.org/okn/o/sdm#HybridModel',
    emulators: 'https://w3id.org/okn/o/sdm#Emulator',
    'theory-guidedmodels': 'https://w3id.org/okn/o/sdm#Theory-GuidedModel',
    theory_guidedmodels: 'https://w3id.org/okn/o/sdm#Theory-GuidedModel',
    coupledmodels: 'https://w3id.org/okn/o/sdm#CoupledModel',
  }
  return SUBTYPE_MAP[resource] ?? null
}

class CatalogServiceImpl {
  /**
   * Generic list handler: GET /resources?username=X&label=Y&page=N&per_page=M
   */
  async list(resource: string, req: any, reply: any) {
    const resourceConfig = getResourceConfig(resource)
    if (!resourceConfig) {
      reply.code(404).send({ error: `Unknown resource type: ${resource}` })
      return
    }
    if (!resourceConfig.hasuraTable) {
      reply.code(501).send({ error: `Resource type '${resource}' not yet implemented` })
      return
    }

    const { username, label, page = 1, per_page = 25 } = req.query || {}
    const limit = parseInt(String(per_page), 10) || 25
    const offset = (parseInt(String(page), 10) - 1) * limit || 0

    // Build dynamic where clause
    const whereConditions: string[] = []
    const variables: Record<string, unknown> = { limit, offset }

    if (username) {
      whereConditions.push('user_id: { _eq: $username }')
      variables['username'] = username
    }
    if (label) {
      whereConditions.push('label: { _eq: $label }')
      variables['label'] = label
    }

    // Software subtype filter
    const typeFilter = getSoftwareTypeFilter(resource)
    if (typeFilter) {
      whereConditions.push('type: { _eq: $typeFilter }')
      variables['typeFilter'] = typeFilter
    }

    const whereClause = whereConditions.length > 0
      ? `where: { ${whereConditions.join(', ')} }`
      : ''

    const fields = buildFieldSelection(resourceConfig)

    // Build variable declarations for query signature
    let varDecls = '$limit: Int!, $offset: Int!'
    if (username) varDecls += ', $username: String!'
    if (label) varDecls += ', $label: String!'
    if (typeFilter) varDecls += ', $typeFilter: String!'

    const queryStr = `
      query ListQuery(${varDecls}) {
        modelcatalog_${resourceConfig.hasuraTable.replace('modelcatalog_', '')}(
          ${whereClause}
          limit: $limit
          offset: $offset
        ) {
          ${fields}
        }
      }
    `

    try {
      const result = await readClient.query({
        query: gql`${queryStr}`,
        variables,
      })
      const data = result.data as Record<string, unknown>
      const dataKey = `modelcatalog_${resourceConfig.hasuraTable.replace('modelcatalog_', '')}`
      const rows: Record<string, unknown>[] = (data[dataKey] as Record<string, unknown>[]) || []
      reply.code(200).send(transformList(rows, resourceConfig))
    } catch (err: any) {
      req.log.error({ err }, 'GraphQL list query failed')
      reply.code(500).send({ error: 'Internal server error', details: err?.message })
    }
  }

  /**
   * Generic get-by-id handler: GET /resources/{id}
   */
  async getById(resource: string, req: any, reply: any) {
    const resourceConfig = getResourceConfig(resource)
    if (!resourceConfig) {
      reply.code(404).send({ error: `Unknown resource type: ${resource}` })
      return
    }
    if (!resourceConfig.hasuraTable) {
      reply.code(501).send({ error: `Resource type '${resource}' not yet implemented` })
      return
    }

    const id = decodeURIComponent(req.params.id)
    const fields = buildFieldSelection(resourceConfig)

    const tableSuffix = resourceConfig.hasuraTable.replace('modelcatalog_', '')
    const queryStr = `
      query GetByIdQuery($id: String!) {
        modelcatalog_${tableSuffix}_by_pk(id: $id) {
          ${fields}
        }
      }
    `

    try {
      const result = await readClient.query({
        query: gql`${queryStr}`,
        variables: { id },
      })
      const data = result.data as Record<string, unknown>
      const dataKey = `modelcatalog_${tableSuffix}_by_pk`
      const row = data[dataKey] as Record<string, unknown> | null
      if (!row) {
        reply.code(404).send({ error: 'Not found' })
        return
      }
      reply.code(200).send(transformRow(row, resourceConfig))
    } catch (err: any) {
      req.log.error({ err }, 'GraphQL getById query failed')
      reply.code(500).send({ error: 'Internal server error', details: err?.message })
    }
  }

  /**
   * Generic create handler: POST /resources
   */
  async create(resource: string, req: any, reply: any) {
    const resourceConfig = getResourceConfig(resource)
    if (!resourceConfig) {
      reply.code(404).send({ error: `Unknown resource type: ${resource}` })
      return
    }
    if (!resourceConfig.hasuraTable) {
      reply.code(501).send({ error: `Resource type '${resource}' not yet implemented` })
      return
    }

    const body = req.body || {}
    const input = toHasuraInput(body as Record<string, unknown>, resourceConfig)

    // Generate a URI-based ID if not provided
    if (!input['id']) {
      input['id'] = `${ID_PREFIX}${randomUUID()}`
    }

    const tableSuffix = resourceConfig.hasuraTable.replace('modelcatalog_', '')
    const mutationStr = `
      mutation CreateMutation($object: modelcatalog_${tableSuffix}_insert_input!) {
        insert_modelcatalog_${tableSuffix}_one(object: $object) {
          id
        }
      }
    `

    const authHeader = req.headers?.authorization
    if (!authHeader) {
      reply.code(401).send({ error: 'Authorization header required' })
      return
    }

    try {
      const writeClient = getWriteClient(authHeader)
      const result = await writeClient.mutate({
        mutation: gql`${mutationStr}`,
        variables: { object: input },
      })
      const data = result.data as Record<string, unknown> | null
      const dataKey = `insert_modelcatalog_${tableSuffix}_one`
      const created = data?.[dataKey] as { id?: string } | undefined
      const createdId = created?.id ?? (input['id'] as string)
      reply.code(201).send({ id: createdId })
    } catch (err: any) {
      req.log.error({ err }, 'GraphQL create mutation failed')
      reply.code(500).send({ error: 'Internal server error', details: err?.message })
    }
  }

  /**
   * Generic update handler: PUT /resources/{id}
   */
  async update(resource: string, req: any, reply: any) {
    const resourceConfig = getResourceConfig(resource)
    if (!resourceConfig) {
      reply.code(404).send({ error: `Unknown resource type: ${resource}` })
      return
    }
    if (!resourceConfig.hasuraTable) {
      reply.code(501).send({ error: `Resource type '${resource}' not yet implemented` })
      return
    }

    const id = decodeURIComponent(req.params.id)
    const body = req.body || {}
    const input = toHasuraInput(body as Record<string, unknown>, resourceConfig)

    const tableSuffix = resourceConfig.hasuraTable.replace('modelcatalog_', '')
    const mutationStr = `
      mutation UpdateMutation($id: String!, $set: modelcatalog_${tableSuffix}_set_input!) {
        update_modelcatalog_${tableSuffix}_by_pk(pk_columns: { id: $id }, _set: $set) {
          id
        }
      }
    `

    const authHeader = req.headers?.authorization
    if (!authHeader) {
      reply.code(401).send({ error: 'Authorization header required' })
      return
    }

    try {
      const writeClient = getWriteClient(authHeader)
      await writeClient.mutate({
        mutation: gql`${mutationStr}`,
        variables: { id, set: input },
      })
      // Return updated object
      const fields = buildFieldSelection(resourceConfig)
      const queryStr = `
        query GetUpdatedQuery($id: String!) {
          modelcatalog_${tableSuffix}_by_pk(id: $id) {
            ${fields}
          }
        }
      `
      const fetchResult = await readClient.query({
        query: gql`${queryStr}`,
        variables: { id },
      })
      const fetchData = fetchResult.data as Record<string, unknown>
      const dataKey = `modelcatalog_${tableSuffix}_by_pk`
      const row = fetchData[dataKey] as Record<string, unknown> | null
      if (!row) {
        reply.code(404).send({ error: 'Not found after update' })
        return
      }
      reply.code(200).send(transformRow(row, resourceConfig))
    } catch (err: any) {
      req.log.error({ err }, 'GraphQL update mutation failed')
      reply.code(500).send({ error: 'Internal server error', details: err?.message })
    }
  }

  /**
   * Generic delete handler: DELETE /resources/{id}
   */
  async deleteResource(resource: string, req: any, reply: any) {
    const resourceConfig = getResourceConfig(resource)
    if (!resourceConfig) {
      reply.code(404).send({ error: `Unknown resource type: ${resource}` })
      return
    }
    if (!resourceConfig.hasuraTable) {
      reply.code(501).send({ error: `Resource type '${resource}' not yet implemented` })
      return
    }

    const id = decodeURIComponent(req.params.id)
    const tableSuffix = resourceConfig.hasuraTable.replace('modelcatalog_', '')
    const mutationStr = `
      mutation DeleteMutation($id: String!) {
        delete_modelcatalog_${tableSuffix}_by_pk(id: $id) {
          id
        }
      }
    `

    const authHeader = req.headers?.authorization
    if (!authHeader) {
      reply.code(401).send({ error: 'Authorization header required' })
      return
    }

    try {
      const writeClient = getWriteClient(authHeader)
      await writeClient.mutate({
        mutation: gql`${mutationStr}`,
        variables: { id },
      })
      reply.code(202).send({ deleted: id })
    } catch (err: any) {
      req.log.error({ err }, 'GraphQL delete mutation failed')
      reply.code(500).send({ error: 'Internal server error', details: err?.message })
    }
  }

  /**
   * Stub for custom endpoints (plan 06 implementation)
   */
  async handleCustom(operationId: string, req: any, reply: any) {
    req.log.warn({ operationId }, 'Custom endpoint not yet implemented')
    reply.code(501).send({ error: `Custom endpoint '${operationId}' not yet implemented` })
  }

  /**
   * Stub for user login endpoint
   */
  async userLogin(req: any, reply: any) {
    reply.code(501).send({ error: 'Login endpoint not yet implemented' })
  }
}

/**
 * CatalogService: a Proxy around CatalogServiceImpl that intercepts operationId method calls
 * and dispatches them to the appropriate generic CRUD handler.
 *
 * OperationId patterns (from openapi.yaml):
 * - softwares_get -> list('softwares', ...)
 * - softwares_id_get -> getById('softwares', ...)
 * - softwares_post -> create('softwares', ...)
 * - softwares_id_put -> update('softwares', ...)
 * - softwares_id_delete -> deleteResource('softwares', ...)
 * - custom_* -> handleCustom(operationId, ...)
 * - user_login_post -> userLogin(...)
 */
/**
 * Returns true if the given operationId is handled by the CatalogService proxy.
 * Used by both the `has` trap (for `in` operator) and the `get` trap.
 */
function isHandledOperationId(prop: string): boolean {
  if (typeof prop !== 'string') return false
  if (prop.startsWith('custom_')) return true
  if (prop === 'user_login_post') return true
  if (/^(.+?)_(id_)?(get|post|put|delete)$/.test(prop)) return true
  return false
}

export const CatalogService = new Proxy(new CatalogServiceImpl(), {
  /**
   * The `has` trap is called by the `in` operator.
   * fastify-openapi-glue checks `operationId in serviceHandlers` to determine
   * if a handler exists. Without this trap, all dynamic operationIds return false
   * and the glue falls back to "Operation not implemented".
   */
  has(target, prop: string) {
    if (isHandledOperationId(prop)) return true
    return prop in target
  },

  get(target, prop: string) {
    // Pass through non-string or symbol properties
    if (typeof prop !== 'string') {
      return (target as any)[prop]
    }

    // Custom endpoints: custom_model_index_get, custom_models_variable_get, etc.
    if (prop.startsWith('custom_')) {
      return (req: any, reply: any) => target.handleCustom(prop, req, reply)
    }

    // User login: user_login_post
    if (prop === 'user_login_post') {
      return (req: any, reply: any) => target.userLogin(req, reply)
    }

    // Standard CRUD operationId pattern: {resource}_(id_)?(get|post|put|delete)
    // The regex uses non-greedy .+? so "theory_guidedmodels_id_get" correctly
    // captures resource="theory_guidedmodels", hasId="id_", method="get"
    const match = prop.match(/^(.+?)_(id_)?(get|post|put|delete)$/)
    if (match) {
      const [, resource, hasId, method] = match
      if (method === 'get' && hasId) return (req: any, reply: any) => target.getById(resource, req, reply)
      if (method === 'get') return (req: any, reply: any) => target.list(resource, req, reply)
      if (method === 'post') return (req: any, reply: any) => target.create(resource, req, reply)
      if (method === 'put') return (req: any, reply: any) => target.update(resource, req, reply)
      if (method === 'delete') return (req: any, reply: any) => target.deleteResource(resource, req, reply)
    }

    // Fall through to native property access (for 'then', Symbol.toStringTag, etc.)
    return (target as any)[prop]
  },
})
