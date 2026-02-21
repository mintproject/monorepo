import Fastify from 'fastify'
import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { readClient, gql } from './hasura/client.js'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OPENAPI_SPEC_PATH = path.join(__dirname, '..', 'openapi.yaml')

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  })

  // CORS -- allow browser clients
  await app.register(cors, { origin: true })

  // Serve OpenAPI spec in static mode (reads existing openapi.yaml)
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
      return { status: 'ok', hasura: 'connected' }
    } catch {
      reply.status(503)
      return { status: 'error', hasura: 'unreachable' }
    }
  })

  // TODO: Register fastify-openapi-glue with service handlers (plan 04)
  // await app.register(openapiGlue, {
  //   specification: OPENAPI_SPEC_PATH,
  //   serviceHandlers: new Service(),
  //   securityHandlers: new Security(),
  //   prefix: 'v2.0.0',
  // })

  return app
}
