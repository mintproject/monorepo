import { createPublicKey, createVerify } from 'node:crypto'

import { gql, readClient } from './hasura/client.js'

const DEFAULT_JWKS_URI = 'https://portals.tapis.io/v3/tenants/portals'
const DEFAULT_ISSUER = 'https://portals.tapis.io/v3/tokens'
const DEFAULT_BODY_LIMIT = 10 * 1024 * 1024
const DEFAULT_MAX_REGIONS = 500
const DEFAULT_MAX_GEOMETRIES = 10
const DEFAULT_MAX_REGION_BYTES = 2 * 1024 * 1024
const JWKS_CACHE_MS = 5 * 60 * 1000

const REGION_CURATOR_QUERY = gql`
  query RegionCuratorAccess($tenantId: String!, $username: String!) {
    region_curator(
      where: {
        tenant_id: { _eq: $tenantId }
        username: { _eq: $username }
        active: { _eq: true }
      }
      limit: 1
    ) {
      tenant_id
      username
    }
  }
`

const INSERT_REGIONS_MUTATION = gql`
  mutation ImportRegions($objects: [region_insert_input!]!) {
    insert_region(objects: $objects) {
      returning {
        id
        name
      }
    }
  }
`

type JsonObject = Record<string, unknown>

export interface RegionImportPayload {
  parent_region_id: string
  category_id: string
  regions: Array<{
    id: string
    name: string
    geometries: Array<JsonObject | string>
  }>
}

interface VerifiedIdentity {
  tenantId: string
  username: string
}

interface JwksCacheEntry {
  expiresAt: number
  keys: JsonObject[]
  publicKeyPem?: string
}

const jwksCache = new Map<string, JwksCacheEntry>()

export class RegionImportError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'RegionImportError'
  }
}

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

export function regionImportBodyLimit(): number {
  return envNumber('REGION_IMPORT_BODY_LIMIT', DEFAULT_BODY_LIMIT)
}

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '='), 'base64')
}

function parseJwtPart(value: string, label: string): JsonObject {
  try {
    const parsed = JSON.parse(decodeBase64Url(value).toString('utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object')
    }
    return parsed as JsonObject
  } catch {
    throw new RegionImportError(401, `Invalid JWT ${label}`)
  }
}

async function fetchVerificationKeys(uri: string): Promise<JwksCacheEntry> {
  const cached = jwksCache.get(uri)
  if (cached && cached.expiresAt > Date.now()) return cached

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const response = await fetch(uri, { signal: controller.signal })
    if (!response.ok) throw new Error(`JWKS returned ${response.status}`)
    const payload = (await response.json()) as JsonObject
    const keys = Array.isArray(payload.keys)
      ? payload.keys.filter((key): key is JsonObject => Boolean(key) && typeof key === 'object')
      : []
    const tapisResult = payload.result
    const publicKeyPem =
      tapisResult && typeof tapisResult === 'object' && !Array.isArray(tapisResult) &&
      typeof (tapisResult as JsonObject).public_key === 'string'
        ? (tapisResult as JsonObject).public_key as string
        : undefined
    if (keys.length === 0 && !publicKeyPem) {
      throw new Error('Tapis key response did not contain verification keys')
    }
    const entry = { keys, publicKeyPem, expiresAt: Date.now() + JWKS_CACHE_MS }
    jwksCache.set(uri, entry)
    return entry
  } catch {
    throw new RegionImportError(503, 'Authentication service unavailable')
  } finally {
    clearTimeout(timeout)
  }
}

async function verifyTapisToken(token: string): Promise<VerifiedIdentity> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new RegionImportError(401, 'Invalid bearer token')

  const header = parseJwtPart(parts[0]!, 'header')
  const claims = parseJwtPart(parts[1]!, 'claims')
  if (header.alg !== 'RS256') {
    throw new RegionImportError(401, 'Unsupported bearer token')
  }

  const issuer = process.env.TAPIS_TOKEN_ISSUER || DEFAULT_ISSUER
  if (claims.iss !== issuer) throw new RegionImportError(401, 'Invalid token issuer')

  const now = Math.floor(Date.now() / 1000)
  if (typeof claims.exp !== 'number' || claims.exp <= now) {
    throw new RegionImportError(401, 'Bearer token expired')
  }
  if (typeof claims.nbf === 'number' && claims.nbf > now) {
    throw new RegionImportError(401, 'Bearer token is not active')
  }

  const verificationKeys = await fetchVerificationKeys(process.env.TAPIS_JWKS_URI || DEFAULT_JWKS_URI)

  try {
    const verifier = createVerify('RSA-SHA256')
    verifier.update(`${parts[0]}.${parts[1]}`)
    verifier.end()
    let publicKey
    if (verificationKeys.publicKeyPem) {
      publicKey = createPublicKey(verificationKeys.publicKeyPem)
    } else {
      const jwk = verificationKeys.keys.find((key) => key.kid === header.kid && key.kty === 'RSA')
      if (!jwk) throw new RegionImportError(401, 'Bearer token key not found')
      publicKey = createPublicKey({ key: jwk as any, format: 'jwk' })
    }
    if (!verifier.verify(publicKey, decodeBase64Url(parts[2]!))) {
      throw new Error('signature mismatch')
    }
  } catch (error) {
    if (error instanceof RegionImportError) throw error
    throw new RegionImportError(401, 'Invalid bearer token signature')
  }

  const tenantId = claims['tapis/tenant_id']
  const username = claims['tapis/username']
  if (typeof tenantId !== 'string' || typeof username !== 'string' || !tenantId || !username) {
    throw new RegionImportError(401, 'Bearer token has no usable identity')
  }
  return { tenantId, username }
}

function bearerToken(req: any): string {
  const header = req.headers?.authorization
  if (typeof header !== 'string' || !/^Bearer\s+\S+$/i.test(header)) {
    throw new RegionImportError(401, 'Authorization header required')
  }
  return header.replace(/^Bearer\s+/i, '')
}

export async function authorizeCurator(req: any): Promise<VerifiedIdentity> {
  const identity = await verifyTapisToken(bearerToken(req))
  try {
    const result = await readClient.query({
      query: REGION_CURATOR_QUERY,
      variables: { tenantId: identity.tenantId, username: identity.username },
      fetchPolicy: 'no-cache',
    })
    const rows = (result.data as JsonObject).region_curator
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new RegionImportError(403, 'Region import access denied')
    }
    return identity
  } catch (error) {
    if (error instanceof RegionImportError) throw error
    req.log.error({ err: error }, 'Region curator lookup failed')
    throw new RegionImportError(503, 'Authorization service unavailable')
  }
}

function parseGeometry(value: unknown): JsonObject {
  const parsed = typeof value === 'string' ? (() => {
    try {
      return JSON.parse(value) as unknown
    } catch {
      return null
    }
  })() : value

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new RegionImportError(400, 'Each geometry must be a GeoJSON geometry object')
  }
  const geometry = parsed as JsonObject
  const validTypes = new Set([
    'Point',
    'MultiPoint',
    'LineString',
    'MultiLineString',
    'Polygon',
    'MultiPolygon',
    'GeometryCollection',
  ])
  if (typeof geometry.type !== 'string' || !validTypes.has(geometry.type)) {
    throw new RegionImportError(400, 'Unsupported GeoJSON geometry type')
  }
  if (geometry.type === 'GeometryCollection') {
    if (!Array.isArray(geometry.geometries) || geometry.geometries.length === 0) {
      throw new RegionImportError(400, 'GeometryCollection cannot be empty')
    }
    geometry.geometries.forEach(parseGeometry)
  } else if (geometry.type === 'Point') {
    if (!isGeoJsonPosition(geometry.coordinates)) {
      throw new RegionImportError(400, 'Point coordinates must be numeric positions')
    }
  } else {
    if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
      throw new RegionImportError(400, 'Geometry coordinates cannot be empty')
    }
    if (!isGeoJsonCoordinateArray(geometry.coordinates)) {
      throw new RegionImportError(400, 'Geometry coordinates must be numeric positions')
    }
  }
  return geometry
}

function isGeoJsonPosition(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    (value.length === 2 || value.length === 3) &&
    value.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate))
  )
}

function isGeoJsonCoordinateArray(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) return false
  if (isGeoJsonPosition(value)) return true
  return value.every((child) => isGeoJsonCoordinateArray(child))
}

export function validateRegionImport(payload: unknown): RegionImportPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new RegionImportError(400, 'Import payload must be an object')
  }
  const input = payload as JsonObject
  const parentRegionId = input.parent_region_id
  const categoryId = input.category_id
  const regions = input.regions
  if (typeof parentRegionId !== 'string' || !parentRegionId.trim()) {
    throw new RegionImportError(400, 'parent_region_id is required')
  }
  if (typeof categoryId !== 'string' || !categoryId.trim()) {
    throw new RegionImportError(400, 'category_id is required')
  }
  if (!Array.isArray(regions) || regions.length === 0) {
    throw new RegionImportError(400, 'At least one region is required')
  }
  if (regions.length > envNumber('REGION_IMPORT_MAX_REGIONS', DEFAULT_MAX_REGIONS)) {
    throw new RegionImportError(413, 'Import exceeds the region limit')
  }

  const ids = new Set<string>()
  const normalized = regions.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new RegionImportError(400, `Region ${index + 1} must be an object`)
    }
    const region = raw as JsonObject
    const id = typeof region.id === 'string' ? region.id.trim() : ''
    const name = typeof region.name === 'string' ? region.name.trim() : ''
    if (!id || !name) throw new RegionImportError(400, `Region ${index + 1} requires id and name`)
    if (ids.has(id)) throw new RegionImportError(409, `Duplicate region id: ${id}`)
    ids.add(id)

    const geometries = region.geometries
    if (!Array.isArray(geometries) || geometries.length === 0) {
      throw new RegionImportError(400, `Region ${id} requires geometry`)
    }
    if (geometries.length > envNumber('REGION_IMPORT_MAX_GEOMETRIES', DEFAULT_MAX_GEOMETRIES)) {
      throw new RegionImportError(413, `Region ${id} exceeds the geometry limit`)
    }
    const normalizedGeometries = geometries.map(parseGeometry).map((geometry) => JSON.stringify(geometry))
    if (Buffer.byteLength(JSON.stringify(normalizedGeometries), 'utf8') > envNumber('REGION_IMPORT_MAX_REGION_BYTES', DEFAULT_MAX_REGION_BYTES)) {
      throw new RegionImportError(413, `Region ${id} exceeds the geometry size limit`)
    }
    return { id, name, geometries: normalizedGeometries }
  })

  return {
    parent_region_id: parentRegionId.trim(),
    category_id: categoryId.trim(),
    regions: normalized,
  }
}

function sendRegionImportError(req: any, reply: any, error: unknown): boolean {
  if (error instanceof RegionImportError) {
    reply.code(error.statusCode).send({ error: error.message })
    return true
  }
  req.log.error({ err: error }, 'Region import request failed')
  reply.code(500).send({ error: 'Region import request failed' })
  return true
}

export async function custom_regions_import_access_get(req: any, reply: any): Promise<void> {
  try {
    await authorizeCurator(req)
    reply.code(200).send({ allowed: true })
  } catch (error) {
    sendRegionImportError(req, reply, error)
  }
}

export async function custom_regions_import_post(req: any, reply: any): Promise<void> {
  try {
    await authorizeCurator(req)
    const payload = validateRegionImport(req.body)
    const objects = payload.regions.map((region) => ({
      id: region.id,
      name: region.name,
      parent_region_id: payload.parent_region_id,
      category_id: payload.category_id,
      geometries: { data: region.geometries.map((geometry) => ({ geometry })) },
    }))

    const result = await readClient.mutate({
      mutation: INSERT_REGIONS_MUTATION,
      variables: { objects },
    })
    const returning = ((result.data as JsonObject | null)?.insert_region as JsonObject | null)?.returning
    const inserted = Array.isArray(returning) ? returning : []
    reply.code(201).send({ count: inserted.length, regions: inserted })
  } catch (error: any) {
    if (error instanceof RegionImportError) {
      sendRegionImportError(req, reply, error)
      return
    }
    const message = String(error?.message ?? '')
    req.log.error({ err: error }, 'Region import mutation failed')
    if (/duplicate|unique|already exists/i.test(message)) {
      reply.code(409).send({ error: 'One or more region IDs already exist' })
      return
    }
    reply.code(502).send({ error: 'Region import write failed' })
  }
}
