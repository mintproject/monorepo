import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }))

vi.mock('../hasura/client.js', () => ({
  readClient: { query: mockQuery },
  gql: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.raw.reduce((result, value, index) => result + value + (values[index] ?? ''), ''),
}))

import { buildApp } from '../app.js'

describe('semantic search routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    vi.stubEnv('SVO_SEMANTIC_SEARCH_WEBHOOK_SECRET', 'test-secret')
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    vi.unstubAllEnvs()
  })

  it('validates the search query and limit before invoking the service', async () => {
    const empty = await app.inject({ method: 'GET', url: '/search' })
    expect(empty.statusCode).toBe(400)

    const tooLong = await app.inject({ method: 'GET', url: `/search?q=${'x'.repeat(201)}` })
    expect(tooLong.statusCode).toBe(400)

    const invalidLimit = await app.inject({ method: 'GET', url: '/search?q=weather&limit=101' })
    expect(invalidLimit.statusCode).toBe(400)
  })

  it('requires the Hasura webhook secret', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/events/catalog',
      payload: { event: { op: 'INSERT' } },
    })

    expect(response.statusCode).toBe(401)
  })

  it('accepts an authenticated catalog event for asynchronous refresh', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/events/catalog',
      headers: { 'x-mint-webhook-secret': 'test-secret' },
      payload: { event: { op: 'INSERT' } },
    })

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.payload)).toEqual({ status: 'accepted' })
  })
})
