/**
 * Integration tests for the CatalogServiceImpl pipeline.
 *
 * Tests the full pipeline: service method -> GraphQL query construction ->
 * response transformation -> v1.8.0-compatible JSON.
 *
 * Apollo Client is mocked to avoid needing a live Hasura instance.
 * The mocks let us assert on the query variables passed (pagination, filters)
 * and the transformation applied to the mock data (array wrapping, type synthesis, null omission).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// vi.mock is hoisted to top of file; use vi.hoisted() to declare shared mocks
// that are accessible both in the factory and in tests.
// ---------------------------------------------------------------------------
const { mockQuery, mockMutate } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockMutate: vi.fn(),
}))

vi.mock('../hasura/client.js', () => ({
  readClient: {
    query: mockQuery,
  },
  getWriteClient: vi.fn().mockReturnValue({
    mutate: mockMutate,
  }),
  gql: (strings: TemplateStringsArray, ...values: unknown[]) => {
    // Simple gql tag passthrough: join template strings for inspection
    return strings.raw.reduce((acc, str, i) => acc + str + (values[i] ?? ''), '')
  },
}))

// Import AFTER mock is set up
import { CatalogService } from '../service.js'

// ---------------------------------------------------------------------------
// Helper: create minimal mock req/reply objects
// ---------------------------------------------------------------------------
function makeReq(overrides: {
  query?: Record<string, string>
  params?: Record<string, string>
  headers?: Record<string, string>
  body?: unknown
} = {}) {
  return {
    query: overrides.query ?? {},
    params: overrides.params ?? {},
    headers: overrides.headers ?? {},
    body: overrides.body ?? {},
    log: { error: vi.fn(), warn: vi.fn() },
  }
}

function makeReply() {
  const reply = {
    _status: 200,
    _body: undefined as unknown,
    code(status: number) { reply._status = status; return reply },
    send(body: unknown) { reply._body = body; return reply },
  }
  return reply
}

// ---------------------------------------------------------------------------
// Test 1: List software - basic pipeline validation
// ---------------------------------------------------------------------------
describe('list software', () => {
  beforeEach(() => { mockQuery.mockReset() })

  it('returns array of v1.8.0-formatted software objects', async () => {
    mockQuery.mockResolvedValueOnce({
      data: {
        modelcatalog_software: [
          {
            id: 'https://w3id.org/okn/i/mint/CYCLES',
            label: 'CYCLES',
            description: 'A multi-process agroecosystem model',
            keywords: null,
            license: null,
            website: null,
            date_created: null,
            date_published: null,
            has_documentation: null,
            has_download_url: null,
            has_purpose: null,
            author_id: null,
            author: null,
            versions: [{ id: 'https://w3id.org/okn/i/mint/CYCLES-v1', label: 'v1', description: null }],
            authors: [],
          },
        ],
      },
    })

    const req = makeReq()
    const reply = makeReply()
    await (CatalogService as any).softwares_get(req, reply)

    expect(reply._status).toBe(200)
    const body = reply._body as any[]
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(1)

    const sw = body[0]
    // id is NOT array-wrapped
    expect(sw.id).toBe('https://w3id.org/okn/i/mint/CYCLES')
    // scalars are array-wrapped
    expect(sw.label).toEqual(['CYCLES'])
    expect(sw.description).toEqual(['A multi-process agroecosystem model'])
    // type is synthesized from resourceConfig.typeArray
    expect(sw.type).toEqual(['Software'])
    // null fields are omitted
    expect('keywords' in sw).toBe(false)
    expect('license' in sw).toBe(false)
    // versions nested relationship is included (registry key is 'versions')
    expect(sw.versions).toBeDefined()
    expect(Array.isArray(sw.versions)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Test 2: Get software by ID - single object returned
// ---------------------------------------------------------------------------
describe('getById software', () => {
  beforeEach(() => { mockQuery.mockReset() })

  it('returns a single v1.8.0-formatted software object', async () => {
    mockQuery.mockResolvedValueOnce({
      data: {
        modelcatalog_software_by_pk: {
          id: 'https://w3id.org/okn/i/mint/CYCLES',
          label: 'CYCLES',
          description: 'A crop model',
          keywords: null,
          license: null,
          website: null,
          date_created: null,
          date_published: null,
          has_documentation: null,
          has_download_url: null,
          has_purpose: null,
          author_id: null,
          author: null,
          versions: [],
          authors: [],
        },
      },
    })

    const req = makeReq({ params: { id: 'https%3A%2F%2Fw3id.org%2Fokn%2Fi%2Fmint%2FCYCLES' } })
    const reply = makeReply()
    await (CatalogService as any).softwares_id_get(req, reply)

    expect(reply._status).toBe(200)
    const sw = reply._body as any
    expect(sw.id).toBe('https://w3id.org/okn/i/mint/CYCLES')
    expect(sw.label).toEqual(['CYCLES'])
    expect(sw.type).toEqual(['Software'])
  })
})

// ---------------------------------------------------------------------------
// Test 3: Get setup with nested data (junction table traversal)
// ---------------------------------------------------------------------------
describe('getById setup with nested data', () => {
  beforeEach(() => { mockQuery.mockReset() })

  it('returns setup with inputs (junction), parameters (junction), and author (FK)', async () => {
    mockQuery.mockResolvedValueOnce({
      data: {
        modelcatalog_model_configuration_setup_by_pk: {
          id: 'https://w3id.org/okn/i/mint/setup1',
          label: 'Test Setup',
          description: 'A test setup',
          has_component_location: null,
          has_implementation_script_location: null,
          has_software_image: null,
          has_region: null,
          author_id: 'https://w3id.org/okn/i/mint/person1',
          calibration_interval: null,
          calibration_method: null,
          parameter_assignment_method: null,
          valid_until: null,
          model_configuration_id: null,
          model_configuration: { id: 'https://w3id.org/okn/i/mint/cfg1', label: 'Config 1' },
          author: { id: 'https://w3id.org/okn/i/mint/person1', label: 'Dr. Smith' },
          inputs: [
            { input: { id: 'https://w3id.org/okn/i/mint/spec1', label: 'precip', description: null, has_format: null, has_dimensionality: null, position: 1 } },
          ],
          outputs: [],
          parameters: [
            { parameter: { id: 'https://w3id.org/okn/i/mint/param1', label: 'alpha', description: null, has_data_type: 'float', has_default_value: '0.5', has_minimum_accepted_value: '0', has_maximum_accepted_value: '1', has_fixed_value: null, position: 1, parameter_type: null } },
          ],
          authors: [],
          calibrated_variables: [],
          calibration_targets: [],
        },
      },
    })

    const req = makeReq({ params: { id: 'https%3A%2F%2Fw3id.org%2Fokn%2Fi%2Fmint%2Fsetup1' } })
    const reply = makeReply()
    await (CatalogService as any).modelconfigurationsetups_id_get(req, reply)

    expect(reply._status).toBe(200)
    const setup = reply._body as any
    expect(setup.id).toBe('https://w3id.org/okn/i/mint/setup1')
    expect(setup.type).toEqual(['ModelConfigurationSetup'])

    // Author is object_relationship -- array-wrapped in v1.8.0
    expect(Array.isArray(setup.author)).toBe(true)
    expect(setup.author[0].id).toBe('https://w3id.org/okn/i/mint/person1')

    // Inputs via junction table -- junction is traversed to target; registry key is 'inputs'
    expect(Array.isArray(setup.inputs)).toBe(true)
    expect(setup.inputs[0].id).toBe('https://w3id.org/okn/i/mint/spec1')

    // Parameters via junction table -- registry key is 'parameters'
    expect(Array.isArray(setup.parameters)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Test 4: Pagination - page=2&per_page=10 -> offset=10, limit=10
// ---------------------------------------------------------------------------
describe('pagination', () => {
  beforeEach(() => { mockQuery.mockReset() })

  it('translates page=2&per_page=10 to offset=10, limit=10 in GraphQL variables', async () => {
    mockQuery.mockResolvedValueOnce({
      data: { modelcatalog_software: [] },
    })

    const req = makeReq({ query: { page: '2', per_page: '10' } })
    const reply = makeReply()
    await (CatalogService as any).softwares_get(req, reply)

    expect(mockQuery).toHaveBeenCalledOnce()
    const callArgs = mockQuery.mock.calls[0][0]
    expect(callArgs.variables).toMatchObject({ limit: 10, offset: 10 })
  })
})

// ---------------------------------------------------------------------------
// Test 5: Label filter - adds where: { label: { _eq: "CYCLES" } }
// ---------------------------------------------------------------------------
describe('label filter', () => {
  beforeEach(() => { mockQuery.mockReset() })

  it('adds label filter to GraphQL query variables when label param provided', async () => {
    mockQuery.mockResolvedValueOnce({
      data: { modelcatalog_software: [] },
    })

    const req = makeReq({ query: { label: 'CYCLES' } })
    const reply = makeReply()
    await (CatalogService as any).softwares_get(req, reply)

    expect(mockQuery).toHaveBeenCalledOnce()
    const callArgs = mockQuery.mock.calls[0][0]
    expect(callArgs.variables).toMatchObject({ label: 'CYCLES' })
    // The query string should include the label where clause
    expect(callArgs.query).toContain('label: { _eq: $label }')
  })
})

// ---------------------------------------------------------------------------
// Test 6: Username filter - translates to user_id WHERE clause
// ---------------------------------------------------------------------------
describe('username filter', () => {
  beforeEach(() => { mockQuery.mockReset() })

  it('translates username=mint@isi.edu to user_id WHERE clause in GraphQL query', async () => {
    mockQuery.mockResolvedValueOnce({
      data: { modelcatalog_software: [] },
    })

    const req = makeReq({ query: { username: 'mint@isi.edu' } })
    const reply = makeReply()
    await (CatalogService as any).softwares_get(req, reply)

    expect(mockQuery).toHaveBeenCalledOnce()
    const callArgs = mockQuery.mock.calls[0][0]
    expect(callArgs.variables).toMatchObject({ username: 'mint@isi.edu' })
    // The query string should include the user_id where clause
    expect(callArgs.query).toContain('user_id: { _eq: $username }')
  })
})

// ---------------------------------------------------------------------------
// Test 7: Null omission - null fields are not included in response
// ---------------------------------------------------------------------------
describe('null omission', () => {
  beforeEach(() => { mockQuery.mockReset() })

  it('omits null and undefined fields from response', async () => {
    mockQuery.mockResolvedValueOnce({
      data: {
        modelcatalog_software: [
          {
            id: 'https://w3id.org/okn/i/mint/CYCLES',
            label: 'CYCLES',
            description: null,
            keywords: undefined,
            license: null,
            website: null,
            date_created: null,
            date_published: null,
            has_documentation: null,
            has_download_url: null,
            has_purpose: null,
            author_id: null,
            author: null,
            versions: [],
            authors: [],
          },
        ],
      },
    })

    const req = makeReq()
    const reply = makeReply()
    await (CatalogService as any).softwares_get(req, reply)

    const body = reply._body as any[]
    const sw = body[0]
    expect('description' in sw).toBe(false)
    expect('keywords' in sw).toBe(false)
    expect('license' in sw).toBe(false)
    // id is always present (even null id would be a bug, but non-null id should be present)
    expect(sw.id).toBe('https://w3id.org/okn/i/mint/CYCLES')
  })
})

// ---------------------------------------------------------------------------
// Test 8: URI-encoded ID decoding
// ---------------------------------------------------------------------------
describe('URI-encoded ID decoding', () => {
  beforeEach(() => { mockQuery.mockReset() })

  it('decodes URI-encoded %2F-containing IDs before querying Hasura', async () => {
    mockQuery.mockResolvedValueOnce({
      data: {
        modelcatalog_software_by_pk: {
          id: 'https://w3id.org/okn/i/mint/CYCLES',
          label: 'CYCLES',
          description: null,
          keywords: null,
          license: null,
          website: null,
          date_created: null,
          date_published: null,
          has_documentation: null,
          has_download_url: null,
          has_purpose: null,
          author_id: null,
          author: null,
          versions: [],
          authors: [],
        },
      },
    })

    // URL-encoded version of "https://w3id.org/okn/i/mint/CYCLES"
    const encodedId = encodeURIComponent('https://w3id.org/okn/i/mint/CYCLES')
    const req = makeReq({ params: { id: encodedId } })
    const reply = makeReply()
    await (CatalogService as any).softwares_id_get(req, reply)

    expect(mockQuery).toHaveBeenCalledOnce()
    const callArgs = mockQuery.mock.calls[0][0]
    // The decoded URI should be passed as the id variable
    expect(callArgs.variables.id).toBe('https://w3id.org/okn/i/mint/CYCLES')
  })
})
