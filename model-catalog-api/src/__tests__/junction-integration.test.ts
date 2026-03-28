/**
 * Live HTTP integration tests for junction-based relationship CRUD.
 *
 * These tests make REAL HTTP requests to the live API at
 * https://api.models.mint.local/v2.0.0/softwares (configurable via MINT_API_URL).
 *
 * Purpose: Validate that buildJunctionInserts() (POST/create) and delete-then-insert
 * (PUT/update) junction handling actually produce correct Hasura mutations that
 * persist correctly, beyond just unit tests.
 *
 * Requirements:
 *   - MINT_API_TOKEN env var must be set to a valid Tapis Bearer token
 *   - MINT_API_URL env var optionally overrides the API base URL
 *   - If using self-signed TLS certs: export NODE_TLS_REJECT_UNAUTHORIZED=0
 *
 * Usage:
 *   MINT_API_TOKEN=<token> npm test -- junction-integration
 *   MINT_API_TOKEN=<token> MINT_API_URL=https://api.models.mint.local/v2.0.0 npm test -- junction-integration
 */

import { describe, it, expect, afterAll } from 'vitest'

const BASE_URL = (process.env.MINT_API_URL ?? 'https://api.models.mint.local/v2.0.0').replace(/\/$/, '')
const TOKEN = process.env.MINT_API_TOKEN

// Timeout (ms) per test — allow for network latency to the live API
const TEST_TIMEOUT = 30_000

// Generate a unique suffix based on timestamp to avoid collisions with real data
const TEST_SUFFIX = `test-${Date.now()}`
const TEST_ID = `https://w3id.org/okn/i/mint/integration-sw-${TEST_SUFFIX}`

// Track created resource IDs for afterAll cleanup
const createdIds: string[] = []

// ---------------------------------------------------------------------------
// Helper: make an authenticated HTTP request
// ---------------------------------------------------------------------------
async function apiRequest(method: string, path: string, body?: unknown): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (TOKEN) {
    headers['Authorization'] = `Bearer ${TOKEN}`
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => null)
  return { status: res.status, data }
}

// ---------------------------------------------------------------------------
// State shared across sequential tests
// ---------------------------------------------------------------------------
let createdSoftwareId: string | null = null

// ---------------------------------------------------------------------------
// Test suite — skipped when token is not set (avoids breaking CI / unit test runs)
// ---------------------------------------------------------------------------
describe.skipIf(!TOKEN)(
  'Junction-based relationship CRUD — live HTTP integration',
  () => {
    // -------------------------------------------------------------------------
    // Test 1: POST /softwares with hasModelCategory (junction insert)
    // -------------------------------------------------------------------------
    it('POST /softwares with hasModelCategory creates software AND category junction rows atomically', async () => {
      const body = {
        id: TEST_ID,
        label: ['Integration Test Software'],
        type: ['Software'],
        hasModelCategory: [
          {
            id: 'https://w3id.org/okn/i/mint/Economy',
            label: ['Economy'],
          },
        ],
      }

      const { status, data } = await apiRequest('POST', '/softwares', body)

      expect(status, `Expected 201 but got ${status}. Response: ${JSON.stringify(data)}`).toBe(201)

      const sw = data as Record<string, unknown>
      expect(sw).toBeDefined()

      // Record the created ID for subsequent tests
      createdSoftwareId = (sw.id as string) ?? TEST_ID
      if (createdSoftwareId) {
        createdIds.push(createdSoftwareId)
      }
    }, TEST_TIMEOUT)

    // -------------------------------------------------------------------------
    // Test 2: GET /softwares/{id} verifies junction data persisted
    // -------------------------------------------------------------------------
    it('GET /softwares/{id} returns the created software with hasModelCategory populated', async () => {
      expect(createdSoftwareId, 'Test 1 must pass first (no createdSoftwareId)').not.toBeNull()

      const encodedId = encodeURIComponent(createdSoftwareId!)
      const { status, data } = await apiRequest('GET', `/softwares/${encodedId}`)

      expect(status, `Expected 200 but got ${status}. Response: ${JSON.stringify(data)}`).toBe(200)

      const sw = data as Record<string, unknown>
      // label should be array-wrapped
      expect(sw.label).toEqual(['Integration Test Software'])

      // hasModelCategory should be an array containing Economy
      const categories = sw.hasModelCategory as Array<Record<string, unknown>>
      expect(Array.isArray(categories), 'hasModelCategory should be an array').toBe(true)
      expect(categories.length).toBeGreaterThanOrEqual(1)
      const economy = categories.find(c => c.id === 'https://w3id.org/okn/i/mint/Economy')
      expect(economy, 'Economy category not found in hasModelCategory').toBeDefined()
    }, TEST_TIMEOUT)

    // -------------------------------------------------------------------------
    // Test 3: PUT /softwares/{id} with hasModelCategory (junction replacement)
    // -------------------------------------------------------------------------
    it('PUT /softwares/{id} with hasModelCategory replaces junction rows (delete-then-insert)', async () => {
      expect(createdSoftwareId, 'Test 1 must pass first (no createdSoftwareId)').not.toBeNull()

      const encodedId = encodeURIComponent(createdSoftwareId!)
      const body = {
        id: createdSoftwareId,
        label: ['Updated Integration Test Software'],
        type: ['Software'],
        hasModelCategory: [
          {
            id: 'https://w3id.org/okn/i/mint/Agriculture',
            label: ['Agriculture'],
          },
        ],
      }

      const { status, data } = await apiRequest('PUT', `/softwares/${encodedId}`, body)

      expect(status, `Expected 200 but got ${status}. Response: ${JSON.stringify(data)}`).toBe(200)

      const sw = data as Record<string, unknown>

      // label should be updated
      expect(sw.label).toEqual(['Updated Integration Test Software'])

      // hasModelCategory should now contain Agriculture, NOT Economy (replace semantics)
      const categories = sw.hasModelCategory as Array<Record<string, unknown>>
      expect(Array.isArray(categories), 'hasModelCategory should be an array').toBe(true)

      const agriculture = categories.find(c => c.id === 'https://w3id.org/okn/i/mint/Agriculture')
      expect(agriculture, 'Agriculture category should be present after PUT').toBeDefined()

      const economy = categories.find(c => c.id === 'https://w3id.org/okn/i/mint/Economy')
      expect(economy, 'Economy category should have been replaced (delete-then-insert semantics)').toBeUndefined()
    }, TEST_TIMEOUT)

    // -------------------------------------------------------------------------
    // Test 4: PUT /softwares/{id} WITHOUT hasModelCategory (Pitfall 2 guard)
    //   Verifies that omitting the junction field in the PUT body leaves
    //   existing junction rows untouched (no unintended deletion).
    // -------------------------------------------------------------------------
    it('PUT without hasModelCategory in body leaves existing junction rows untouched', async () => {
      expect(createdSoftwareId, 'Test 1 must pass first (no createdSoftwareId)').not.toBeNull()

      const encodedId = encodeURIComponent(createdSoftwareId!)
      // Deliberately omit hasModelCategory — only update description
      const body = {
        id: createdSoftwareId,
        type: ['Software'],
        description: ['Updated description'],
      }

      const { status, data } = await apiRequest('PUT', `/softwares/${encodedId}`, body)

      expect(status, `Expected 200 but got ${status}. Response: ${JSON.stringify(data)}`).toBe(200)

      const sw = data as Record<string, unknown>

      // Agriculture junction rows should still be present
      const categories = sw.hasModelCategory as Array<Record<string, unknown>>
      expect(Array.isArray(categories), 'hasModelCategory should still be an array').toBe(true)

      const agriculture = categories.find(c => c.id === 'https://w3id.org/okn/i/mint/Agriculture')
      expect(agriculture, 'Agriculture category should still be present (PUT without field = no-op on junction)').toBeDefined()
    }, TEST_TIMEOUT)

    // -------------------------------------------------------------------------
    // Test 5: GET /softwares/{id} final verification — confirms PUT results persisted
    // -------------------------------------------------------------------------
    it('GET /softwares/{id} final verification confirms all PUT changes are persisted', async () => {
      expect(createdSoftwareId, 'Test 1 must pass first (no createdSoftwareId)').not.toBeNull()

      const encodedId = encodeURIComponent(createdSoftwareId!)
      const { status, data } = await apiRequest('GET', `/softwares/${encodedId}`)

      expect(status, `Expected 200 but got ${status}. Response: ${JSON.stringify(data)}`).toBe(200)

      const sw = data as Record<string, unknown>

      // Scalar fields reflect the last PUT
      expect(sw.label).toEqual(['Updated Integration Test Software'])
      expect(sw.description).toEqual(['Updated description'])

      // Junction reflects Agriculture (from Test 3) and still untouched by Test 4
      const categories = sw.hasModelCategory as Array<Record<string, unknown>>
      expect(Array.isArray(categories)).toBe(true)

      const agriculture = categories.find(c => c.id === 'https://w3id.org/okn/i/mint/Agriculture')
      expect(agriculture, 'Agriculture category must persist across GET after PUT').toBeDefined()

      const economy = categories.find(c => c.id === 'https://w3id.org/okn/i/mint/Economy')
      expect(economy, 'Economy category should not reappear after being replaced').toBeUndefined()
    }, TEST_TIMEOUT)
  },
)

// ---------------------------------------------------------------------------
// afterAll cleanup: delete each resource created during the test run
// (runs even if describe.skipIf skipped the suite — harmless when createdIds is empty)
// ---------------------------------------------------------------------------
afterAll(async () => {
  for (const id of createdIds) {
    const encodedId = encodeURIComponent(id)
    const { status } = await apiRequest('DELETE', `/softwares/${encodedId}`)
    if (status !== 200 && status !== 204 && status !== 404) {
      console.warn(`[junction-integration] cleanup: DELETE /softwares/${encodedId} returned ${status}`)
    }
  }
})

// ===========================================================================
// Helper: generate a reusable junction CRUD suite
// ===========================================================================

interface JunctionTestConfig {
  suiteName: string
  endpoint: string
  testIdSuffix: string
  typeArray: string[]
  junctionField: string
  initialJunction: object
  replacedJunction: object
  initialJunctionId: string
  replacedJunctionId: string
  setup?: () => Promise<void>
  teardown?: () => Promise<void>
}

function junctionCrudSuite(config: JunctionTestConfig): void {
  const {
    suiteName,
    endpoint,
    testIdSuffix,
    typeArray,
    junctionField,
    initialJunction,
    replacedJunction,
    initialJunctionId,
    replacedJunctionId,
    setup,
    teardown,
  } = config

  const resourceTestId = `https://w3id.org/okn/i/mint/integration-${testIdSuffix}-${TEST_SUFFIX}`
  const createdResourceIds: Array<{ endpoint: string; id: string }> = []
  let createdId: string | null = null

  describe.skipIf(!TOKEN)(suiteName, () => {
    // Optional setup (e.g. create prerequisite resources)
    if (setup) {
      it('setup: create prerequisite resources', async () => {
        await setup()
      }, TEST_TIMEOUT)
    }

    // -----------------------------------------------------------------------
    // Test 1: POST with junction field
    // -----------------------------------------------------------------------
    it(`POST ${endpoint} with ${junctionField} creates resource AND junction rows atomically`, async () => {
      const body = {
        id: resourceTestId,
        label: [`Integration Test ${typeArray[0]}`],
        type: typeArray,
        [junctionField]: [initialJunction],
      }

      const { status, data } = await apiRequest('POST', endpoint, body)

      expect(status, `Expected 201 but got ${status}. Response: ${JSON.stringify(data)}`).toBe(201)

      const resource = data as Record<string, unknown>
      expect(resource).toBeDefined()

      createdId = (resource.id as string) ?? resourceTestId
      if (createdId) {
        createdResourceIds.push({ endpoint, id: createdId })
      }
    }, TEST_TIMEOUT)

    // -----------------------------------------------------------------------
    // Test 2: GET verifies junction data persisted
    // -----------------------------------------------------------------------
    it(`GET ${endpoint}/{id} returns created resource with ${junctionField} populated`, async () => {
      expect(createdId, 'Test 1 must pass first (no createdId)').not.toBeNull()

      const encodedId = encodeURIComponent(createdId!)
      const { status, data } = await apiRequest('GET', `${endpoint}/${encodedId}`)

      expect(status, `Expected 200 but got ${status}. Response: ${JSON.stringify(data)}`).toBe(200)

      const resource = data as Record<string, unknown>
      expect(resource.label).toEqual([`Integration Test ${typeArray[0]}`])

      const junctionItems = resource[junctionField] as Array<Record<string, unknown>>
      expect(Array.isArray(junctionItems), `${junctionField} should be an array`).toBe(true)
      expect(junctionItems.length).toBeGreaterThanOrEqual(1)
      const initial = junctionItems.find(item => item.id === initialJunctionId)
      expect(initial, `Initial junction item (${initialJunctionId}) not found in ${junctionField}`).toBeDefined()
    }, TEST_TIMEOUT)

    // -----------------------------------------------------------------------
    // Test 3: PUT with junction field (replacement)
    // -----------------------------------------------------------------------
    it(`PUT ${endpoint}/{id} with ${junctionField} replaces junction rows (delete-then-insert)`, async () => {
      expect(createdId, 'Test 1 must pass first (no createdId)').not.toBeNull()

      const encodedId = encodeURIComponent(createdId!)
      const body = {
        id: createdId,
        label: [`Updated Integration Test ${typeArray[0]}`],
        type: typeArray,
        [junctionField]: [replacedJunction],
      }

      const { status, data } = await apiRequest('PUT', `${endpoint}/${encodedId}`, body)

      expect(status, `Expected 200 but got ${status}. Response: ${JSON.stringify(data)}`).toBe(200)

      const resource = data as Record<string, unknown>
      expect(resource.label).toEqual([`Updated Integration Test ${typeArray[0]}`])

      const junctionItems = resource[junctionField] as Array<Record<string, unknown>>
      expect(Array.isArray(junctionItems), `${junctionField} should be an array`).toBe(true)

      const replaced = junctionItems.find(item => item.id === replacedJunctionId)
      expect(replaced, `Replaced junction item (${replacedJunctionId}) should be present after PUT`).toBeDefined()

      const original = junctionItems.find(item => item.id === initialJunctionId)
      expect(original, `Initial junction item should have been replaced (delete-then-insert semantics)`).toBeUndefined()
    }, TEST_TIMEOUT)

    // -----------------------------------------------------------------------
    // Test 4: PUT WITHOUT junction field (no-op guard)
    // -----------------------------------------------------------------------
    it(`PUT ${endpoint}/{id} without ${junctionField} leaves existing junction rows untouched`, async () => {
      expect(createdId, 'Test 1 must pass first (no createdId)').not.toBeNull()

      const encodedId = encodeURIComponent(createdId!)
      const body = {
        id: createdId,
        type: typeArray,
        description: ['Updated description'],
      }

      const { status, data } = await apiRequest('PUT', `${endpoint}/${encodedId}`, body)

      expect(status, `Expected 200 but got ${status}. Response: ${JSON.stringify(data)}`).toBe(200)

      const resource = data as Record<string, unknown>

      const junctionItems = resource[junctionField] as Array<Record<string, unknown>>
      expect(Array.isArray(junctionItems), `${junctionField} should still be an array`).toBe(true)

      const replaced = junctionItems.find(item => item.id === replacedJunctionId)
      expect(replaced, `Replaced junction item should still be present (PUT without field = no-op on junction)`).toBeDefined()
    }, TEST_TIMEOUT)

    // -----------------------------------------------------------------------
    // Test 5: GET final verification
    // -----------------------------------------------------------------------
    it(`GET ${endpoint}/{id} final verification confirms all PUT changes are persisted`, async () => {
      expect(createdId, 'Test 1 must pass first (no createdId)').not.toBeNull()

      const encodedId = encodeURIComponent(createdId!)
      const { status, data } = await apiRequest('GET', `${endpoint}/${encodedId}`)

      expect(status, `Expected 200 but got ${status}. Response: ${JSON.stringify(data)}`).toBe(200)

      const resource = data as Record<string, unknown>

      expect(resource.label).toEqual([`Updated Integration Test ${typeArray[0]}`])
      expect(resource.description).toEqual(['Updated description'])

      const junctionItems = resource[junctionField] as Array<Record<string, unknown>>
      expect(Array.isArray(junctionItems)).toBe(true)

      const replaced = junctionItems.find(item => item.id === replacedJunctionId)
      expect(replaced, `Replaced junction item must persist across GET after PUT`).toBeDefined()

      const original = junctionItems.find(item => item.id === initialJunctionId)
      expect(original, `Initial junction item should not reappear after being replaced`).toBeUndefined()
    }, TEST_TIMEOUT)

    // -----------------------------------------------------------------------
    // Cleanup
    // -----------------------------------------------------------------------
    afterAll(async () => {
      for (const { endpoint: ep, id } of createdResourceIds) {
        const encodedId = encodeURIComponent(id)
        const { status } = await apiRequest('DELETE', `${ep}/${encodedId}`)
        if (status !== 200 && status !== 204 && status !== 404) {
          console.warn(`[junction-integration] cleanup: DELETE ${ep}/${encodedId} returned ${status}`)
        }
      }
      if (teardown) {
        await teardown()
      }
    })
  })
}

// ===========================================================================
// Suite: modelconfigurations with hasModelCategory
// ===========================================================================

junctionCrudSuite({
  suiteName: 'Junction CRUD — modelconfigurations with hasModelCategory',
  endpoint: '/modelconfigurations',
  testIdSuffix: 'mc',
  typeArray: ['ModelConfiguration'],
  junctionField: 'hasModelCategory',
  initialJunction: { id: 'https://w3id.org/okn/i/mint/Economy', label: ['Economy'] },
  replacedJunction: { id: 'https://w3id.org/okn/i/mint/Agriculture', label: ['Agriculture'] },
  initialJunctionId: 'https://w3id.org/okn/i/mint/Economy',
  replacedJunctionId: 'https://w3id.org/okn/i/mint/Agriculture',
})

// ===========================================================================
// Suite: modelconfigurationsetups with hasModelCategory
// ===========================================================================

junctionCrudSuite({
  suiteName: 'Junction CRUD — modelconfigurationsetups with hasModelCategory',
  endpoint: '/modelconfigurationsetups',
  testIdSuffix: 'mcs',
  typeArray: ['ModelConfigurationSetup'],
  junctionField: 'hasModelCategory',
  initialJunction: { id: 'https://w3id.org/okn/i/mint/Economy', label: ['Economy'] },
  replacedJunction: { id: 'https://w3id.org/okn/i/mint/Agriculture', label: ['Agriculture'] },
  initialJunctionId: 'https://w3id.org/okn/i/mint/Economy',
  replacedJunctionId: 'https://w3id.org/okn/i/mint/Agriculture',
})

// ===========================================================================
// Suite: parameters with hasIntervention
// (requires creating Intervention resources as prerequisites)
// ===========================================================================

const interventionId1 = `https://w3id.org/okn/i/mint/integration-interv-${TEST_SUFFIX}`
const interventionId2 = `https://w3id.org/okn/i/mint/integration-interv2-${TEST_SUFFIX}`
const createdInterventionIds: string[] = []

junctionCrudSuite({
  suiteName: 'Junction CRUD — parameters with hasIntervention',
  endpoint: '/parameters',
  testIdSuffix: 'param',
  typeArray: ['Parameter'],
  junctionField: 'hasIntervention',
  initialJunction: { id: interventionId1 },
  replacedJunction: { id: interventionId2 },
  initialJunctionId: interventionId1,
  replacedJunctionId: interventionId2,
  setup: async () => {
    // Create both interventions before the parameter tests run
    for (const [intervId, label] of [
      [interventionId1, 'Test Intervention 1'],
      [interventionId2, 'Test Intervention 2'],
    ] as [string, string][]) {
      const { status, data } = await apiRequest('POST', '/interventions', {
        id: intervId,
        label: [label],
        type: ['Intervention'],
      })
      if (status === 201 || status === 200) {
        createdInterventionIds.push(intervId)
      } else {
        console.warn(`[junction-integration] setup: POST /interventions returned ${status}: ${JSON.stringify(data)}`)
      }
    }
  },
  teardown: async () => {
    for (const id of createdInterventionIds) {
      const encodedId = encodeURIComponent(id)
      const { status } = await apiRequest('DELETE', `/interventions/${encodedId}`)
      if (status !== 200 && status !== 204 && status !== 404) {
        console.warn(`[junction-integration] teardown: DELETE /interventions/${encodedId} returned ${status}`)
      }
    }
  },
})
