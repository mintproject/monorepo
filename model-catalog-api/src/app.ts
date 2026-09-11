import Fastify from 'fastify'
import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import openapiGlue from 'fastify-openapi-glue'
import { readFileSync } from 'fs'
import { parse as parseYaml } from 'yaml'
import { readClient, gql } from './hasura/client.js'
import { CatalogService } from './service.js'
import { SecurityHandler } from './security.js'
import { fileURLToPath } from 'url'
import path from 'path'
import { MAX_QUERY_LENGTH, MAX_RESULT_LIMIT, semanticSearchService } from './semantic-search.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OPENAPI_SPEC_PATH = path.join(__dirname, '..', 'openapi.yaml')

/**
 * Load the OpenAPI spec and strip all response schemas.
 *
 * Rationale: The openapi.yaml contains complex inline response schemas with
 * deep $ref chains. Fastify's AJV-based serializer fails on these schemas
 * (broken circular $ref paths) and even when it doesn't fail, compiling 243
 * response schemas takes 30+ seconds. Since our responses are dynamically
 * built by the CatalogService (not schema-serialized), we strip response schemas
 * to skip Fastify response schema compilation entirely.
 *
 * The original openapi.yaml is still served unmodified by @fastify/swagger.
 */
function loadSpecWithoutResponseSchemas(): Record<string, unknown> {
  const raw = readFileSync(OPENAPI_SPEC_PATH, 'utf-8')
  const spec = parseYaml(raw) as Record<string, unknown>

  const paths = spec['paths'] as Record<string, Record<string, unknown>> | undefined
  if (paths) {
    for (const pathItem of Object.values(paths)) {
      for (const operation of Object.values(pathItem)) {
        if (typeof operation !== 'object' || operation === null) continue
        const op = operation as Record<string, unknown>

        // Strip response schemas: prevents AJV from compiling complex inline schemas
        // that either have broken $ref paths or take 30+ seconds to compile.
        if ('responses' in op) {
          const responses = op['responses'] as Record<string, unknown>
          for (const code of Object.keys(responses)) {
            responses[code] = { description: 'Response' }
          }
        }

        // Strip request body schemas: the CatalogService does its own input transformation
        // via toHasuraInput() so Fastify schema validation is redundant and slow.
        if ('requestBody' in op && typeof op['requestBody'] === 'object' && op['requestBody'] !== null) {
          const rb = op['requestBody'] as Record<string, unknown>
          if (rb['content'] && typeof rb['content'] === 'object') {
            const content = rb['content'] as Record<string, unknown>
            for (const ct of Object.keys(content)) {
              ;(content[ct] as Record<string, unknown>)['schema'] = {}
            }
          }
        }
      }
    }
  }

  // Also remove global components/schemas to prevent AJV from compiling them
  delete spec['components']

  return spec
}

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
    // Disable AJV strict mode to allow OpenAPI keywords like 'example', 'nullable'
    // that are valid in OpenAPI 3.0 but not in standard JSON Schema
    ajv: {
      customOptions: {
        strict: false,
        keywords: ['example', 'xml', 'externalDocs'],
      },
    },
  })

  // Structured request/response logging
  app.addHook('onRequest', async (req) => {
    req.log.info({ method: req.method, url: req.url }, 'request started')
  })
  app.addHook('onResponse', async (req, reply) => {
    req.log.info(
      {
        method: req.method,
        url: req.url,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      'request completed',
    )
  })

  // CORS -- allow browser clients
  await app.register(cors, { origin: true })

  // Serve OpenAPI spec in static mode (reads existing openapi.yaml, unmodified)
  await app.register(swagger, {
    mode: 'static',
    specification: {
      path: OPENAPI_SPEC_PATH,
      baseDir: path.dirname(OPENAPI_SPEC_PATH),
    },
  })

  // Swagger UI at /v2.0.0/docs
  await app.register(swaggerUi, {
    routePrefix: '/v2.0.0/docs',
  })

  // Health check endpoint -- verifies Hasura connectivity
  app.get('/health', async (_req, reply) => {
    try {
      await readClient.query({ query: gql`{ __typename }` })
      return {
        status: 'ok',
        hasura: 'connected',
        semantic_search: semanticSearchService.status,
      }
    } catch {
      reply.status(503)
      return {
        status: 'error',
        hasura: 'unreachable',
        semantic_search: semanticSearchService.status,
      }
    }
  })

  // Semantic search belongs to the catalog API because it searches catalog
  // records. Inference/indexing remain behind semanticSearchService so the
  // generated CRUD handlers do not own model lifecycle or database SQL.
  app.get('/search', async (req, reply) => {
    const query = String((req.query as Record<string, unknown> | undefined)?.q ?? '').trim()
    const rawLimit = (req.query as Record<string, unknown> | undefined)?.limit ?? 20
    const limit = Number(rawLimit)

    if (!query) {
      reply.code(400).send({ error: 'Query parameter q is required' })
      return
    }
    if (query.length > MAX_QUERY_LENGTH) {
      reply.code(400).send({ error: `Query parameter q must be ${MAX_QUERY_LENGTH} characters or fewer` })
      return
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_RESULT_LIMIT) {
      reply.code(400).send({ error: `Query parameter limit must be an integer between 1 and ${MAX_RESULT_LIMIT}` })
      return
    }

    try {
      return await semanticSearchService.search(query, limit)
    } catch (error) {
      req.log.error({ err: error }, 'semantic search failed')
      reply.code(503).send({ error: 'Semantic search is temporarily unavailable' })
    }
  })

  app.post('/events/catalog', async (req, reply) => {
    const expectedSecret = process.env.SVO_SEMANTIC_SEARCH_WEBHOOK_SECRET
    const receivedSecret = req.headers['x-mint-webhook-secret']
    if (!expectedSecret || receivedSecret !== expectedSecret) {
      reply.code(401).send({ error: 'Invalid webhook credentials' })
      return
    }

    semanticSearchService.requestRefresh()
    return { status: 'accepted' }
  })

  // Start model loading/indexing without delaying ordinary catalog API startup.
  // /search remains unavailable until the model and database are ready, while
  // /health distinguishes catalog availability from semantic readiness.
  void semanticSearchService.initialize()

  // Load spec with response schemas stripped to avoid AJV compilation errors
  // and dramatically speed up startup (~30s -> ~2s)
  const specForRouting = loadSpecWithoutResponseSchemas()

  // Register fastify-openapi-glue: maps all 243 operationIds to CatalogService methods
  await app.register(openapiGlue, {
    specification: specForRouting,
    serviceHandlers: CatalogService,
    securityHandlers: SecurityHandler,
    prefix: 'v2.0.0',
  })

  return app
}
