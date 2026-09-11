import { Pool } from 'pg'

export const EMBEDDING_DIMENSIONS = 384
export const DEFAULT_MODEL = 'Xenova/all-MiniLM-L6-v2'
export const DEFAULT_REFRESH_SECONDS = 60
export const MAX_QUERY_LENGTH = 200
export const MAX_RESULT_LIMIT = 100

type EmbeddingTensor = {
  data: Float32Array | number[]
  dims: number[]
}

type FeatureExtractor = (
  texts: string | string[],
  options: { pooling: 'mean'; normalize: true },
) => Promise<EmbeddingTensor>

export interface EmbeddingProvider {
  readonly modelName: string
  initialize(): Promise<void>
  embed(texts: string[]): Promise<number[][]>
  isReady(): boolean
}

/**
 * Singleton model loader used by both query-time search and the indexer.
 * Transformers.js performs ONNX inference in Node without requiring a Python
 * runtime. The provider boundary keeps that choice replaceable if the model
 * later needs its own worker deployment.
 */
export class TransformersEmbeddingProvider implements EmbeddingProvider {
  readonly modelName: string
  private extractorPromise: Promise<FeatureExtractor> | undefined
  private ready = false

  constructor(modelName = process.env.SVO_EMBEDDING_MODEL || DEFAULT_MODEL) {
    this.modelName = modelName
  }

  async initialize(): Promise<void> {
    await this.getExtractor()
    this.ready = true
  }

  isReady(): boolean {
    return this.ready
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []
    const extractor = await this.getExtractor()
    const output = await extractor(texts, { pooling: 'mean', normalize: true })
    const [batchSize, dimensions] = output.dims

    if (dimensions !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Embedding model returned ${dimensions} dimensions; expected ${EMBEDDING_DIMENSIONS}`,
      )
    }
    if (batchSize !== texts.length) {
      throw new Error(`Embedding model returned ${batchSize} rows for ${texts.length} inputs`)
    }

    const values = Array.from(output.data)
    return Array.from({ length: batchSize }, (_, index) =>
      values.slice(index * dimensions, (index + 1) * dimensions),
    )
  }

  private getExtractor(): Promise<FeatureExtractor> {
    if (!this.extractorPromise) {
      this.extractorPromise = import('@huggingface/transformers').then(({ pipeline }) =>
        pipeline('feature-extraction', this.modelName) as unknown as Promise<FeatureExtractor>,
      )
    }
    return this.extractorPromise
  }
}

export interface SemanticSearchStatus {
  database: 'unconfigured' | 'connecting' | 'ready' | 'error'
  model: 'pending' | 'loading' | 'ready' | 'error'
  index: 'pending' | 'refreshing' | 'ready' | 'error'
  lastIndexedAt: string | null
  lastError: string | null
}

type CatalogVariableRow = {
  id: string
  label: string | null
  description: string | null
  model_context: string | null
  semantic_text: string | null
  has_embedding: boolean
}

type VariableSearchRow = {
  id: string
  label: string | null
  description: string | null
  score: number | string
}

type ModelLinkRow = {
  variable_id: string
  model_id: string
  model_label: string | null
  role: 'input' | 'output'
}

const CATALOG_VARIABLE_CONTEXT_SQL = `
  SELECT sv.id,
         sv.label,
         sv.description,
         COALESCE(context.model_context, '') AS model_context,
         sv.semantic_text,
         sv.embedding IS NOT NULL AS has_embedding
  FROM modelcatalog_standard_variable sv
  LEFT JOIN LATERAL (
    SELECT string_agg(
             DISTINCT concat_ws(' ',
               c.label,
               c.description,
               c.keywords,
               c.usage_notes,
               s.label,
               s.description,
               s.keywords,
               v.label,
               v.description,
               v.keywords,
               v.short_description,
               v.theoretical_basis
             ),
             ' '
           ) AS model_context
    FROM (
      SELECT configuration_id, input_id AS dataset_specification_id
      FROM modelcatalog_configuration_input
      UNION ALL
      SELECT configuration_id, output_id AS dataset_specification_id
      FROM modelcatalog_configuration_output
    ) links
    JOIN modelcatalog_configuration c ON c.id = links.configuration_id
    LEFT JOIN modelcatalog_software_version v ON v.id = c.software_version_id
    LEFT JOIN modelcatalog_software s ON s.id = v.software_id
    JOIN modelcatalog_dataset_specification_presentation dsp
      ON dsp.dataset_specification_id = links.dataset_specification_id
    JOIN modelcatalog_variable_presentation vp ON vp.id = dsp.presentation_id
    WHERE vp.has_standard_variable = sv.id
  ) context ON TRUE
`

const MODEL_LINKS_SQL = `
  WITH links AS (
    SELECT configuration_id, input_id AS dataset_specification_id, 'input' AS role
    FROM modelcatalog_configuration_input
    UNION ALL
    SELECT configuration_id, output_id AS dataset_specification_id, 'output' AS role
    FROM modelcatalog_configuration_output
  )
  SELECT vp.has_standard_variable AS variable_id, c.id AS model_id, c.label AS model_label, links.role
  FROM links
  JOIN modelcatalog_configuration c ON c.id = links.configuration_id
  JOIN modelcatalog_dataset_specification_presentation dsp
    ON dsp.dataset_specification_id = links.dataset_specification_id
  JOIN modelcatalog_variable_presentation vp ON vp.id = dsp.presentation_id
  WHERE vp.has_standard_variable = ANY($1)
  ORDER BY c.label, links.role
`

export function embeddingText(
  label: string | null,
  description: string | null,
  modelContext: string | null,
): string {
  return `${label || ''}. ${description || ''}. Models and workflows: ${modelContext || ''}`
}

export function vectorLiteral(vector: number[]): string {
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Expected ${EMBEDDING_DIMENSIONS} vector values, got ${vector.length}`)
  }
  return `[${vector.join(',')}]`
}

export class SemanticSearchService {
  private readonly pool: Pool | null
  private readonly provider: EmbeddingProvider
  private readonly batchSize: number
  private readonly refreshSeconds: number
  private readonly maxConcurrentSearches: number
  private readonly statusValue: SemanticSearchStatus
  private initialization: Promise<void> | undefined
  private refreshInFlight: Promise<void> | undefined
  private refreshRequested = false
  private stopped = false
  private refreshTimer: ReturnType<typeof setTimeout> | undefined
  private activeSearches = 0

  constructor(options: {
    databaseUrl?: string
    provider?: EmbeddingProvider
    pool?: Pool
    batchSize?: number
    refreshSeconds?: number
  } = {}) {
    const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL
    this.pool = options.pool ?? (databaseUrl ? new Pool({
      connectionString: databaseUrl,
      max: 4,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
    }) : null)
    this.provider = options.provider ?? new TransformersEmbeddingProvider()
    this.batchSize = Math.max(Number(options.batchSize ?? process.env.SVO_EMBEDDING_BATCH_SIZE ?? 32), 1)
    this.refreshSeconds = Math.max(
      Number(options.refreshSeconds ?? process.env.SVO_EMBEDDING_REFRESH_SECONDS ?? DEFAULT_REFRESH_SECONDS),
      5,
    )
    this.maxConcurrentSearches = Math.max(
      Number(process.env.SVO_SEARCH_CONCURRENCY ?? 4),
      1,
    )
    this.statusValue = {
      database: this.pool ? 'connecting' : 'unconfigured',
      model: 'pending',
      index: 'pending',
      lastIndexedAt: null,
      lastError: null,
    }
  }

  get status(): SemanticSearchStatus {
    return { ...this.statusValue }
  }

  async initialize(): Promise<void> {
    if (!this.initialization) {
      this.initialization = this.initializeOnce()
    }
    return this.initialization
  }

  requestRefresh(): void {
    this.refreshRequested = true
    if (!this.initialization || this.statusValue.model !== 'ready') return
    void this.runRefresh(false)
  }

  async search(query: string, limit: number): Promise<{
    results: Array<{
      id: string
      label: string | null
      description: string | null
      score: number
      models: Array<{ id: string; label: string | null; role: 'input' | 'output' }>
    }>
  }> {
    if (query.trim().length === 0) throw new Error('Query must not be empty')
    if (query.length > MAX_QUERY_LENGTH) throw new Error(`Query must be ${MAX_QUERY_LENGTH} characters or fewer`)
    if (!this.pool) throw new Error('Semantic search database is not configured')
    if (this.activeSearches >= this.maxConcurrentSearches) {
      throw new Error('Semantic search is busy; retry shortly')
    }
    this.activeSearches += 1

    try {
      await this.initialize()
      if (this.statusValue.model !== 'ready') throw new Error('Semantic search model is not ready')

      const [vector] = await this.provider.embed([query])
      const client = await this.pool.connect()
      try {
        const rows = await client.query<VariableSearchRow>(
        `
          SELECT id, label, description,
            (0.7 * (1 - (embedding <=> $1::vector)) +
             0.3 * ts_rank(to_tsvector('english', coalesce(semantic_text, '')),
                           plainto_tsquery('english', $2))) AS score
          FROM modelcatalog_standard_variable
          WHERE embedding IS NOT NULL
          ORDER BY score DESC
          LIMIT $3
        `,
        [vectorLiteral(vector), query, limit],
      )
        const variableIds = rows.rows.map((row) => row.id)
        const links = variableIds.length === 0
          ? { rows: [] as ModelLinkRow[] }
          : await client.query<ModelLinkRow>(MODEL_LINKS_SQL, [variableIds])

        const modelsByVariable = new Map<string, Array<{ id: string; label: string | null; role: 'input' | 'output' }>>()
        const seen = new Set<string>()
        for (const link of links.rows) {
          const key = `${link.variable_id}:${link.model_id}:${link.role}`
          if (seen.has(key)) continue
          seen.add(key)
          const models = modelsByVariable.get(link.variable_id) ?? []
          models.push({ id: link.model_id, label: link.model_label, role: link.role })
          modelsByVariable.set(link.variable_id, models)
        }

        return {
          results: rows.rows.map((row) => ({
            id: row.id,
            label: row.label,
            description: row.description,
            score: Number(row.score),
            models: modelsByVariable.get(row.id) ?? [],
          })),
        }
      } finally {
        client.release()
      }
    } finally {
      this.activeSearches -= 1
    }
  }

  async stop(): Promise<void> {
    this.stopped = true
    if (this.refreshTimer) clearTimeout(this.refreshTimer)
    await this.refreshInFlight
    if (this.pool) await this.pool.end()
  }

  private async initializeOnce(): Promise<void> {
    this.statusValue.model = 'loading'
    try {
      await this.provider.initialize()
      this.statusValue.model = 'ready'
    } catch (error) {
      this.statusValue.model = 'error'
      this.statusValue.index = 'error'
      this.statusValue.lastError = error instanceof Error ? error.message : String(error)
      return
    }

    if (!this.pool) return
    try {
      await this.pool.query('SELECT 1')
      this.statusValue.database = 'ready'
      await this.runRefresh(true)
      this.schedulePeriodicRefresh()
    } catch (error) {
      this.statusValue.database = 'error'
      this.statusValue.index = 'error'
      this.statusValue.lastError = error instanceof Error ? error.message : String(error)
    }
  }

  private async runRefresh(force: boolean): Promise<void> {
    if (this.refreshInFlight || !this.pool || this.stopped) {
      this.refreshRequested = true
      return this.refreshInFlight
    }
    this.refreshRequested = false
    this.statusValue.index = 'refreshing'
    this.refreshInFlight = this.refreshEmbeddings(force)
      .then(() => {
        this.statusValue.index = 'ready'
        this.statusValue.lastIndexedAt = new Date().toISOString()
        this.statusValue.lastError = null
      })
      .catch((error) => {
        this.statusValue.index = 'error'
        this.statusValue.lastError = error instanceof Error ? error.message : String(error)
      })
      .finally(() => {
        this.refreshInFlight = undefined
        if (this.refreshRequested && !this.stopped) void this.runRefresh(false)
      })
    return this.refreshInFlight
  }

  private async refreshEmbeddings(force: boolean): Promise<void> {
    const client = await this.pool!.connect()
    try {
      const result = await client.query<CatalogVariableRow>(CATALOG_VARIABLE_CONTEXT_SQL)
      const pending = result.rows
        .map((row) => ({ row, text: embeddingText(row.label, row.description, row.model_context) }))
        .filter(({ row, text }) => force || row.semantic_text !== text || !row.has_embedding)

      for (let offset = 0; offset < pending.length; offset += this.batchSize) {
        const batch = pending.slice(offset, offset + this.batchSize)
        const vectors = await this.provider.embed(batch.map((item) => item.text))
        await client.query('BEGIN')
        try {
          await client.query('SET LOCAL statement_timeout = 30000')
          for (let index = 0; index < batch.length; index += 1) {
            await client.query(
              `UPDATE modelcatalog_standard_variable
               SET semantic_text = $1, embedding = $2::vector
               WHERE id = $3`,
              [batch[index].text, vectorLiteral(vectors[index]), batch[index].row.id],
            )
          }
          await client.query('COMMIT')
        } catch (error) {
          await client.query('ROLLBACK')
          throw error
        }
      }
    } finally {
      client.release()
    }
  }

  private schedulePeriodicRefresh(): void {
    if (this.stopped) return
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined
      void this.runRefresh(false)
      this.schedulePeriodicRefresh()
    }, this.refreshSeconds * 1000)
    this.refreshTimer.unref?.()
  }
}

export const semanticSearchService = new SemanticSearchService()
