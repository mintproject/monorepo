import { describe, expect, it, vi } from 'vitest'
import {
  EMBEDDING_DIMENSIONS,
  SemanticSearchService,
  embeddingText,
  vectorLiteral,
  type EmbeddingProvider,
} from '../semantic-search.js'

function vector(seed: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, index) => seed + index / 1000)
}

function fakePool() {
  const client = {
    query: vi.fn(async (sql: string) => {
      if (sql.includes('FROM modelcatalog_standard_variable sv')) {
        return {
          rows: [{
            id: 'sv-1',
            label: 'air_temperature',
            description: 'Air temperature',
            model_context: 'Weather model input',
            semantic_text: null,
            has_embedding: false,
          }],
        }
      }
      if (sql.includes('ORDER BY score DESC')) {
        return {
          rows: [{ id: 'sv-1', label: 'air_temperature', description: 'Air temperature', score: '0.91' }],
        }
      }
      if (sql.includes('FROM links')) {
        return {
          rows: [{ variable_id: 'sv-1', model_id: 'model-1', model_label: 'Weather Model', role: 'input' }],
        }
      }
      return { rows: [] }
    }),
    release: vi.fn(),
  }
  return {
    query: vi.fn(async () => ({ rows: [] })),
    connect: vi.fn(async () => client),
    end: vi.fn(async () => undefined),
    client,
  }
}

function fakeProvider(): EmbeddingProvider {
  return {
    modelName: 'test-model',
    initialize: vi.fn(async () => undefined),
    isReady: vi.fn(() => true),
    embed: vi.fn(async (texts: string[]) => texts.map(() => vector(0.1))),
  }
}

describe('semantic search primitives', () => {
  it('builds the same indexed text shape used by the Python service', () => {
    expect(embeddingText('air_temperature', 'Air temperature', 'Weather model input'))
      .toBe('air_temperature. Air temperature. Models and workflows: Weather model input')
  })

  it('rejects vectors with the wrong dimension before sending SQL', () => {
    expect(() => vectorLiteral([1, 2, 3])).toThrow('Expected 384 vector values')
  })
})

describe('SemanticSearchService', () => {
  it('indexes pending rows and returns linked model results', async () => {
    const pool = fakePool()
    const provider = fakeProvider()
    const service = new SemanticSearchService({
      pool: pool as never,
      provider,
      batchSize: 1,
      refreshSeconds: 60,
    })

    await service.initialize()
    const result = await service.search('weather', 20)

    expect(provider.embed).toHaveBeenCalled()
    expect(pool.client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE modelcatalog_standard_variable'),
      expect.arrayContaining(['sv-1']),
    )
    expect(result.results).toEqual([
      {
        id: 'sv-1',
        label: 'air_temperature',
        description: 'Air temperature',
        score: 0.91,
        models: [{ id: 'model-1', label: 'Weather Model', role: 'input' }],
      },
    ])
    await service.stop()
  })

  it('reports an unconfigured database without attempting model work', async () => {
    const provider = fakeProvider()
    const service = new SemanticSearchService({ provider })

    await expect(service.search('weather', 20)).rejects.toThrow('database is not configured')
    expect(provider.embed).not.toHaveBeenCalled()
  })
})
