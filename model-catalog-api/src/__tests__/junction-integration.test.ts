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
