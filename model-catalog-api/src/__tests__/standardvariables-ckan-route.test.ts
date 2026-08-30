/**
 * Route-level test for the CKAN autocomplete contract.
 *
 * The unit tests in integration.test.ts call the service directly, which
 * bypasses Fastify. This test goes through the real router so it also proves
 * that `label_contains` and `enable_ckan` survive fastify-openapi-glue's
 * querystring validation (undeclared params are stripped by AJV) and that
 * `enable_ckan` is coerced from its query-string form to a boolean.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }))

vi.mock('../hasura/client.js', async () => {
  const actual = await vi.importActual<typeof import('@apollo/client/core')>(
    '@apollo/client/core',
  )
  return {
    readClient: { query: mockQuery },
    getWriteClient: vi.fn(),
    gql: actual.gql,
  }
})

import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance

async function getApp(): Promise<FastifyInstance> {
  if (!app) {
    app = await buildApp()
    await app.ready()
  }
  return app
}

afterAll(async () => {
  if (app) await app.close()
})

const TWO_ROWS = {
  data: {
    modelcatalog_standard_variable: [
      { id: 'https://w3id.org/okn/i/mint/A', label: 'land_surface_wind__speed' },
      { id: 'https://w3id.org/okn/i/mint/B', label: 'land_surface_air__temperature' },
    ],
  },
}

describe('GET /v2.0.0/standardvariables (CKAN autocomplete contract)', () => {
  beforeEach(() => { mockQuery.mockReset() })

  it('passes label_contains through routing and builds an ilike filter', async () => {
    mockQuery.mockResolvedValueOnce(TWO_ROWS)
    const instance = await getApp()

    const res = await instance.inject({
      method: 'GET',
      url: '/v2.0.0/standardvariables?label_contains=land_surface',
    })

    expect(res.statusCode).toBe(200)
    const callArgs = mockQuery.mock.calls[0][0]
    expect(callArgs.variables).toMatchObject({ labelContains: '%land\\_surface%' })
  })

  it('coerces enable_ckan=true and returns the CKAN ResultSet shape', async () => {
    mockQuery.mockResolvedValueOnce(TWO_ROWS)
    const instance = await getApp()

    const res = await instance.inject({
      method: 'GET',
      url: '/v2.0.0/standardvariables?label_contains=land&enable_ckan=true',
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload)).toEqual({
      ResultSet: {
        Result: [
          { Name: 'land_surface_wind__speed' },
          { Name: 'land_surface_air__temperature' },
        ],
      },
    })
  })

  it('still returns the plain array without enable_ckan', async () => {
    mockQuery.mockResolvedValueOnce(TWO_ROWS)
    const instance = await getApp()

    const res = await instance.inject({
      method: 'GET',
      url: '/v2.0.0/standardvariables?label_contains=land',
    })

    const body = JSON.parse(res.payload)
    expect(Array.isArray(body)).toBe(true)
    expect(body[0]).toMatchObject({ label: ['land_surface_wind__speed'] })
  })

  it('keeps label an exact match through the route', async () => {
    mockQuery.mockResolvedValueOnce({ data: { modelcatalog_standard_variable: [] } })
    const instance = await getApp()

    await instance.inject({
      method: 'GET',
      url: '/v2.0.0/standardvariables?label=land_surface_wind__speed',
    })

    const callArgs = mockQuery.mock.calls[0][0]
    expect(callArgs.variables).toMatchObject({ label: 'land_surface_wind__speed' })
    expect(callArgs.variables).not.toHaveProperty('labelContains')
  })
})
