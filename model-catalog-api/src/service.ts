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
import { getResourceConfig } from './mappers/resource-registry.js'
import { transformRow, transformList } from './mappers/response.js'
import { toHasuraInput, buildJunctionInserts } from './mappers/request.js'
import { readClient, getWriteClient, gql } from './hasura/client.js'
import { getFieldSelection } from './hasura/field-maps.js'
import { customHandlers } from './custom-handlers.js'

const ID_PREFIX = 'https://w3id.org/okn/i/mint/'


/**
 * Build where clause for software subtype filtering.
 * Software subtypes (models, emulators, etc.) share the modelcatalog_software table.
 * The type is stored in a `type` column in Hasura.
 */
export function getSoftwareTypeFilter(resource: string): string | string[] | null {
  const SUBTYPE_MAP: Record<string, string | string[]> = {
    models: [
      'https://w3id.org/okn/o/sdm#Model',
      'https://w3id.org/okn/o/sdm#EmpiricalModel',
      'https://w3id.org/okn/o/sdm#CoupledModel',
      'https://w3id.org/okn/o/sdm#Emulator',
      'https://w3id.org/okn/o/sdm#HybridModel',
      'https://w3id.org/okn/o/sdm#Theory-GuidedModel',
    ],
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
      // No backing table -- return empty list (matches v1.8.0 behavior for empty named graphs)
      reply.code(200).send([])
      return
    }

    const { username, label, page = 1, per_page = 25 } = req.query || {}
    const limit = parseInt(String(per_page), 10) || 25
    const offset = (parseInt(String(page), 10) - 1) * limit || 0

    // Build dynamic where clause
    const whereConditions: string[] = []
    const variables: Record<string, unknown> = { limit, offset }

    if (label) {
      whereConditions.push('label: { _eq: $label }')
      variables['label'] = label
    }

    // Software subtype filter
    const typeFilter = getSoftwareTypeFilter(resource)
    if (typeFilter) {
      if (Array.isArray(typeFilter)) {
        whereConditions.push('type: { _in: $typeFilter }')
      } else {
        whereConditions.push('type: { _eq: $typeFilter }')
      }
      variables['typeFilter'] = typeFilter
    }

    const whereClause = whereConditions.length > 0
      ? `where: { ${whereConditions.join(', ')} }`
      : ''

    const fields = getFieldSelection(resourceConfig.hasuraTable!)

    // Build variable declarations for query signature
    let varDecls = '$limit: Int!, $offset: Int!'
    if (label) varDecls += ', $label: String!'
    if (typeFilter) {
      varDecls += Array.isArray(typeFilter) ? ', $typeFilter: [String!]!' : ', $typeFilter: String!'
    }

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
      // No backing table -- resource cannot exist
      reply.code(404).send({ error: 'Not found' })
      return
    }

    const id = decodeURIComponent(req.params.id)
    const fullId = id.startsWith('https://') ? id : `${resourceConfig.idPrefix}${id}`
    const fields = getFieldSelection(resourceConfig.hasuraTable!)

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
        variables: { id: fullId },
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

    // Only set the type column for resources stored in modelcatalog_software, which is the
    // only table with a `type` column (used to distinguish Model subtypes like
    // sdm#Model, sdm#EmpiricalModel, sd#Software, etc.).
    // Other tables (modelcatalog_model_configuration, modelcatalog_software_version, etc.)
    // lack this column and must NOT receive a type field in their INSERT inputs.
    if (resourceConfig.hasuraTable === 'modelcatalog_software') {
      input['type'] = resourceConfig.typeUri
    }

    // Generate a URI-based ID if not provided
    if (!input['id']) {
      input['id'] = `${ID_PREFIX}${randomUUID()}`
    }

    // Build junction insert data for relationship fields (D-01, D-03, D-06)
    const junctionInserts = buildJunctionInserts(body as Record<string, unknown>, resourceConfig)

    // Merge scalar input with junction nested inserts for atomic mutation (D-03)
    const object = { ...input, ...junctionInserts }

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
        variables: { object },
      })
      const data = result.data as Record<string, unknown> | null
      const dataKey = `insert_modelcatalog_${tableSuffix}_one`
      const created = data?.[dataKey] as { id?: string } | undefined
      const createdId = created?.id ?? (input['id'] as string)
      reply.code(201).send({ id: createdId })
    } catch (err: any) {
      req.log.error({ err }, 'GraphQL create mutation failed')
      const msg = err?.message || ''
      if (msg.includes('uniqueness violation') || msg.includes('constraint')) {
        reply.code(400).send({ error: 'Constraint violation', details: msg })
        return
      }
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
    const fullId = id.startsWith('https://') ? id : `${resourceConfig.idPrefix}${id}`
    const body = req.body || {}
    const input = toHasuraInput(body as Record<string, unknown>, resourceConfig)

    const tableSuffix = resourceConfig.hasuraTable.replace('modelcatalog_', '')

    const authHeader = req.headers?.authorization
    if (!authHeader) {
      reply.code(401).send({ error: 'Authorization header required' })
      return
    }

    // Identify junction relationships explicitly present in the request body (D-07: Pitfall 2 guard)
    const junctionParts: string[] = []
    const variables: Record<string, unknown> = { id: fullId, set: input }

    for (const [apiFieldName, relConfig] of Object.entries(resourceConfig.relationships)) {
      if (!relConfig.junctionTable || !relConfig.junctionRelName || !relConfig.parentFkColumn) continue
      // Only process junctions for relationship fields explicitly in the request body
      if (body[apiFieldName] === undefined) continue

      const juncSuffix = relConfig.junctionTable.replace('modelcatalog_', '')

      // Step 1: Delete existing junction rows for this relationship (D-07: replace semantics)
      junctionParts.push(
        `del_${relConfig.hasuraRelName}: delete_modelcatalog_${juncSuffix}(where: { ${relConfig.parentFkColumn}: { _eq: $id } }) { affected_rows }`
      )

      // Step 2: Insert new junction rows with flat FK columns
      const rawValue = body[apiFieldName]
      if (!Array.isArray(rawValue) || rawValue.length === 0) continue

      const targetFkColumn = `${relConfig.junctionRelName}_id`
      const varName = `junc_${relConfig.hasuraRelName}`

      const items = (rawValue as unknown[]).map((item: unknown) =>
        typeof item === 'string' ? { id: item } : (item as Record<string, unknown>)
      )

      variables[varName] = items.map((item: Record<string, unknown>) => {
        const rawItemId = item['id'] as string | undefined
        const targetId = rawItemId
          ? rawItemId.startsWith('https://') ? rawItemId : `${ID_PREFIX}${rawItemId}`
          : `${ID_PREFIX}${randomUUID()}`
        const row: Record<string, unknown> = {
          [relConfig.parentFkColumn!]: fullId,
          [targetFkColumn]: targetId,
        }
        if (relConfig.junctionColumns) {
          for (const [colName, camelKey] of Object.entries(relConfig.junctionColumns)) {
            if (item[camelKey] !== undefined) row[colName] = item[camelKey]
          }
        }
        return row
      })

      const juncSuffix2 = relConfig.junctionTable.replace('modelcatalog_', '')
      junctionParts.push(
        `ins_${relConfig.hasuraRelName}: insert_modelcatalog_${juncSuffix2}(objects: $${varName}, on_conflict: { constraint: modelcatalog_${juncSuffix2}_pkey, update_columns: [] }) { affected_rows }`
      )
    }

    // Build mutation string: simple _set if no junctions, multi-root otherwise (D-03)
    let mutationStr: string
    if (junctionParts.length === 0) {
      mutationStr = `
        mutation UpdateMutation($id: String!, $set: modelcatalog_${tableSuffix}_set_input!) {
          update_modelcatalog_${tableSuffix}_by_pk(pk_columns: { id: $id }, _set: $set) {
            id
          }
        }
      `
    } else {
      // Build variable declarations for junction insert arrays
      const juncVarDecls = Object.entries(resourceConfig.relationships)
        .filter(([apiFieldName, relConfig]) =>
          relConfig.junctionTable &&
          relConfig.junctionRelName &&
          relConfig.parentFkColumn &&
          body[apiFieldName] !== undefined &&
          Array.isArray(body[apiFieldName]) &&
          (body[apiFieldName] as unknown[]).length > 0
        )
        .map(([, relConfig]) => {
          const juncSuffix = relConfig.junctionTable!.replace('modelcatalog_', '')
          return `$junc_${relConfig.hasuraRelName}: [modelcatalog_${juncSuffix}_insert_input!]!`
        })
        .join(', ')

      const extraVarDecls = juncVarDecls ? `, ${juncVarDecls}` : ''
      mutationStr = `
        mutation UpdateWithJunctions($id: String!, $set: modelcatalog_${tableSuffix}_set_input!${extraVarDecls}) {
          update_modelcatalog_${tableSuffix}_by_pk(pk_columns: { id: $id }, _set: $set) { id }
          ${junctionParts.join('\n          ')}
        }
      `
    }

    try {
      const writeClient = getWriteClient(authHeader)
      await writeClient.mutate({
        mutation: gql`${mutationStr}`,
        variables,
      })
      // Return updated object
      const fields = getFieldSelection(resourceConfig.hasuraTable!)
      const queryStr = `
        query GetUpdatedQuery($id: String!) {
          modelcatalog_${tableSuffix}_by_pk(id: $id) {
            ${fields}
          }
        }
      `
      const fetchResult = await readClient.query({
        query: gql`${queryStr}`,
        variables: { id: fullId },
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
      const msg = err?.message || ''
      if (msg.includes('uniqueness violation') || msg.includes('constraint')) {
        reply.code(400).send({ error: 'Constraint violation', details: msg })
        return
      }
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
    const fullId = id.startsWith('https://') ? id : `${resourceConfig.idPrefix}${id}`
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
        variables: { id: fullId },
      })
      reply.code(202).send({ deleted: fullId })
    } catch (err: any) {
      req.log.error({ err }, 'GraphQL delete mutation failed')
      reply.code(500).send({ error: 'Internal server error', details: err?.message })
    }
  }

  /**
   * Dispatch custom endpoints to the customHandlers registry.
   * All 13 /custom/ operationIds and user_login_post are handled here.
   */
  async handleCustom(operationId: string, req: any, reply: any) {
    const handler = customHandlers[operationId]
    if (handler) {
      return handler(req, reply)
    }
    req.log.warn({ operationId }, 'Custom endpoint not implemented')
    reply.code(501).send({ error: `Custom endpoint '${operationId}' not implemented` })
  }

  /**
   * user_login_post is also dispatched through customHandlers.
   */
  async userLogin(req: any, reply: any) {
    const handler = customHandlers['user_login_post']
    if (handler) {
      return handler(req, reply)
    }
    reply.code(501).send({ error: 'Login endpoint not implemented' })
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
