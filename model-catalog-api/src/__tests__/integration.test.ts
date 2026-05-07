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
import { customHandlers } from '../custom-handlers.js'

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
    // versions nested relationship is included (registry key is 'hasVersion' in softwares config)
    expect(sw.hasVersion).toBeDefined()
    expect(Array.isArray(sw.hasVersion)).toBe(true)
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
        modelcatalog_configuration_by_pk: {
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
          parent_configuration: { id: 'https://w3id.org/okn/i/mint/cfg1', label: 'Config 1' },
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

    // Inputs via junction table -- junction is traversed to target; registry key is 'hasInput'
    expect(Array.isArray(setup.hasInput)).toBe(true)
    expect(setup.hasInput[0].id).toBe('https://w3id.org/okn/i/mint/spec1')

    // Parameters via junction table -- registry key is 'hasParameter'
    expect(Array.isArray(setup.hasParameter)).toBe(true)
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
// Test 6: Username filter - accepted but ignored (no-op, no user_id column in schema)
// The modelcatalog_* tables have no user_id column; username param is accepted for
// API compatibility but does not produce any WHERE clause filtering.
// ---------------------------------------------------------------------------
describe('username filter', () => {
  beforeEach(() => { mockQuery.mockReset() })

  it('accepts username=mint@isi.edu but does not add user_id WHERE clause', async () => {
    mockQuery.mockResolvedValueOnce({
      data: { modelcatalog_software: [] },
    })

    const req = makeReq({ query: { username: 'mint@isi.edu' } })
    const reply = makeReply()
    await (CatalogService as any).softwares_get(req, reply)

    expect(mockQuery).toHaveBeenCalledOnce()
    const callArgs = mockQuery.mock.calls[0][0]
    // username is NOT passed as a GraphQL variable (no-op)
    expect(callArgs.variables).not.toHaveProperty('username')
    // The query string must NOT include the user_id where clause
    expect(callArgs.query).not.toContain('user_id')
    // Basic pagination variables are still present
    expect(callArgs.variables).toMatchObject({ limit: 25, offset: 0 })
    // Request succeeds normally
    expect(reply._status).toBe(200)
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

// ---------------------------------------------------------------------------
// Test 9: Plain ID rejected — strict URI mode (bug-086)
// service.ts treats {id} as opaque; plain shortname returns 400.
// ---------------------------------------------------------------------------
describe('getById with plain ID (no URI prefix)', () => {
  beforeEach(() => { mockQuery.mockReset() })

  it('returns 400 when id does not start with https:// (strict URI mode)', async () => {
    const req = makeReq({ params: { id: '1bade4cb-d924-4253-bfa9-4c02b461396a' } })
    const reply = makeReply()
    await (CatalogService as any).softwares_id_get(req, reply)

    expect(reply._status).toBe(400)
    expect(mockQuery).not.toHaveBeenCalled()
    expect((reply._body as any)?.error).toContain('full URL-encoded URI')
  })
})

// ---------------------------------------------------------------------------
// Test 10: Custom handler plain-ID resolution
// ---------------------------------------------------------------------------
describe('Custom handler URI strict mode', () => {
  beforeEach(() => { mockQuery.mockReset() })

  it('custom_configurationsetups_id_get returns 400 for plain ID (strict URI mode)', async () => {
    const req = makeReq({ params: { id: 'hand_v6' } })
    const reply = makeReply()
    await customHandlers.custom_configurationsetups_id_get(req, reply)

    expect(reply._status).toBe(400)
    expect(mockQuery).not.toHaveBeenCalled()
    expect((reply._body as any)?.error).toContain('full URL-encoded URI')
  })

  it('custom_modelconfigurationsetups_id_get passes full URI unchanged', async () => {
    const fullUri = 'https://w3id.org/okn/i/mint/hand_v6'
    mockQuery.mockResolvedValueOnce({
      data: {
        modelcatalog_configuration_by_pk: {
          id: fullUri,
          label: 'hand_v6',
        },
      },
    })

    const req = makeReq({ params: { id: encodeURIComponent(fullUri) } })
    const reply = makeReply()
    await customHandlers.custom_modelconfigurationsetups_id_get(req, reply)

    expect(reply._status).toBe(200)
    expect(mockQuery).toHaveBeenCalledOnce()
    const callArgs = mockQuery.mock.calls[0][0]
    expect(callArgs.variables.id).toBe(fullUri)
  })

  it('custom_datasetspecifications_get returns 400 for plain configurationid (strict URI mode)', async () => {
    const req = makeReq({ query: { configurationid: 'some-config-uuid' } })
    const reply = makeReply()
    await customHandlers.custom_datasetspecifications_get(req, reply)

    expect(reply._status).toBe(400)
    expect(mockQuery).not.toHaveBeenCalled()
    expect((reply._body as any)?.error).toContain('full URL-encoded URI')
  })

  it('custom_datasetspecifications_get WHERE clause uses configuration_id not model_configuration_id', async () => {
    mockQuery.mockResolvedValueOnce({
      data: {
        modelcatalog_configuration_input: [],
        modelcatalog_configuration_output: [],
      },
    })

    const cfgUri = 'https://w3id.org/okn/i/mint/some-config-uuid'
    const req = makeReq({ query: { configurationid: encodeURIComponent(cfgUri) } })
    const reply = makeReply()
    await customHandlers.custom_datasetspecifications_get(req, reply)

    expect(mockQuery).toHaveBeenCalledOnce()
    const callArgs = mockQuery.mock.calls[0][0]
    const queryStr = typeof callArgs.query === 'string' ? callArgs.query : callArgs.query?.loc?.source?.body ?? ''
    expect(queryStr).toContain('configuration_id')
    expect(queryStr).not.toContain('model_configuration_id')
    expect(callArgs.variables.cfgId).toBe(cfgUri)
  })
})

// ---------------------------------------------------------------------------
// FK-on-child relationships: parent.hasVersion / hasConfiguration / hasSetup
// where the child carries an FK column pointing back to the parent.
// ---------------------------------------------------------------------------
describe('PUT model with hasVersion sets software_id on child rows', () => {
  beforeEach(() => { mockQuery.mockReset(); mockMutate.mockReset() })

  it('emits clear+link update_modelcatalog_software_version mutations with software_id', async () => {
    mockMutate.mockResolvedValueOnce({ data: {} })
    mockQuery.mockResolvedValueOnce({
      data: {
        modelcatalog_software_by_pk: {
          id: 'https://w3id.org/okn/i/mint/MODEL-1',
          label: 'M',
          description: null,
        },
      },
    })

    const req = makeReq({
      params: { id: encodeURIComponent('https://w3id.org/okn/i/mint/MODEL-1') },
      headers: { authorization: 'Bearer test' },
      body: {
        type: ['https://w3id.org/okn/o/sdm#Model'],
        id: 'https://w3id.org/okn/i/mint/MODEL-1',
        label: ['M'],
        hasVersion: [{ id: 'https://w3id.org/okn/i/mint/V-1' }],
      },
    })
    const reply = makeReply()
    await (CatalogService as any).models_id_put(req, reply)

    expect(mockMutate).toHaveBeenCalledOnce()
    const args = mockMutate.mock.calls[0][0]
    const m = typeof args.mutation === 'string' ? args.mutation : args.mutation?.loc?.source?.body ?? ''
    expect(m).toContain('clear_versions: update_modelcatalog_software_version')
    expect(m).toContain('link_versions: update_modelcatalog_software_version')
    expect(m).toContain('software_id: { _eq: $id }')
    expect(m).toContain('software_id: $id')
    expect(args.variables.child_ids_versions).toEqual(['https://w3id.org/okn/i/mint/V-1'])
    expect(args.variables.id).toBe('https://w3id.org/okn/i/mint/MODEL-1')
  })

  it('omits link branch when hasVersion is empty array (clear-only replace semantics)', async () => {
    mockMutate.mockResolvedValueOnce({ data: {} })
    mockQuery.mockResolvedValueOnce({
      data: {
        modelcatalog_software_by_pk: { id: 'https://w3id.org/okn/i/mint/MODEL-2', label: 'M2', description: null },
      },
    })

    const req = makeReq({
      params: { id: encodeURIComponent('https://w3id.org/okn/i/mint/MODEL-2') },
      headers: { authorization: 'Bearer test' },
      body: {
        type: ['https://w3id.org/okn/o/sdm#Model'],
        id: 'https://w3id.org/okn/i/mint/MODEL-2',
        label: ['M2'],
        hasVersion: [],
      },
    })
    const reply = makeReply()
    await (CatalogService as any).models_id_put(req, reply)

    const args = mockMutate.mock.calls[0][0]
    const m = typeof args.mutation === 'string' ? args.mutation : args.mutation?.loc?.source?.body ?? ''
    expect(m).toContain('clear_versions:')
    expect(m).not.toContain('link_versions:')
    expect(args.variables.child_ids_versions).toEqual([])
  })

  it('handles softwareversions.hasConfiguration -> software_version_id', async () => {
    mockMutate.mockResolvedValueOnce({ data: {} })
    mockQuery.mockResolvedValueOnce({
      data: {
        modelcatalog_software_version_by_pk: {
          id: 'https://w3id.org/okn/i/mint/V-1',
          label: 'v1',
          description: null,
        },
      },
    })

    const req = makeReq({
      params: { id: encodeURIComponent('https://w3id.org/okn/i/mint/V-1') },
      headers: { authorization: 'Bearer test' },
      body: {
        id: 'https://w3id.org/okn/i/mint/V-1',
        label: ['v1'],
        hasConfiguration: [{ id: 'https://w3id.org/okn/i/mint/CFG-1' }],
      },
    })
    const reply = makeReply()
    await (CatalogService as any).softwareversions_id_put(req, reply)

    const args = mockMutate.mock.calls[0][0]
    const m = typeof args.mutation === 'string' ? args.mutation : args.mutation?.loc?.source?.body ?? ''
    expect(m).toContain('clear_configurations: update_modelcatalog_configuration')
    expect(m).toContain('link_configurations: update_modelcatalog_configuration')
    expect(m).toContain('software_version_id: { _eq: $id }')
    expect(m).toContain('software_version_id: $id')
  })
})

describe('POST software with hasVersion links existing version rows', () => {
  beforeEach(() => { mockMutate.mockReset() })

  it('emits insert + link_versions update with software_id = parentId', async () => {
    mockMutate.mockResolvedValueOnce({
      data: {
        insert_modelcatalog_software_one: { id: 'https://w3id.org/okn/i/mint/NEW-1' },
      },
    })

    const req = makeReq({
      headers: { authorization: 'Bearer test' },
      body: {
        type: ['Software'],
        id: 'https://w3id.org/okn/i/mint/NEW-1',
        label: ['New'],
        hasVersion: [{ id: 'https://w3id.org/okn/i/mint/V-99' }],
      },
    })
    const reply = makeReply()
    await (CatalogService as any).softwares_post(req, reply)

    expect(mockMutate).toHaveBeenCalledOnce()
    const args = mockMutate.mock.calls[0][0]
    const m = typeof args.mutation === 'string' ? args.mutation : args.mutation?.loc?.source?.body ?? ''
    expect(m).toContain('insert_modelcatalog_software_one')
    expect(m).toContain('link_versions: update_modelcatalog_software_version')
    expect(m).toContain('software_id: $parentId')
    expect(args.variables.parentId).toBe('https://w3id.org/okn/i/mint/NEW-1')
    expect(args.variables.child_ids_versions).toEqual(['https://w3id.org/okn/i/mint/V-99'])
  })
})
