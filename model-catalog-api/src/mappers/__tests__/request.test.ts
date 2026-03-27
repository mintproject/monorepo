import { describe, it, expect } from 'vitest';
import { toHasuraInput, camelToSnake } from '../request.js';
import { getResourceConfig } from '../resource-registry.js';

// ============================================================================
// camelToSnake utility
// ============================================================================

describe('camelToSnake', () => {
  it('converts camelCase to snake_case', () => {
    expect(camelToSnake('hasSourceCode')).toBe('has_source_code');
    expect(camelToSnake('shortDescription')).toBe('short_description');
    expect(camelToSnake('dateCreated')).toBe('date_created');
    expect(camelToSnake('hasDownloadUrl')).toBe('has_download_url');
  });

  it('leaves already-lowercase strings unchanged', () => {
    expect(camelToSnake('label')).toBe('label');
    expect(camelToSnake('id')).toBe('id');
  });
});

// ============================================================================
// toHasuraInput column validation
// ============================================================================

describe('toHasuraInput - models resource (modelcatalog_software table)', () => {
  const modelsConfig = getResourceConfig('models')!;

  it('drops shortDescription -- not a column on modelcatalog_software', () => {
    const result = toHasuraInput({ shortDescription: ['test'] }, modelsConfig);
    expect(result).not.toHaveProperty('short_description');
  });

  it('drops hasModelCategory -- not a relationship on models config and not a column', () => {
    const result = toHasuraInput(
      { hasModelCategory: [{ id: 'http://example.org/cat1', label: ['Economy'] }] },
      modelsConfig,
    );
    expect(result).not.toHaveProperty('has_model_category');
  });

  it('includes label and description -- valid scalar columns on modelcatalog_software', () => {
    const result = toHasuraInput(
      { label: ['Test Model'], description: ['A model description'] },
      modelsConfig,
    );
    expect(result).toEqual({ label: 'Test Model', description: 'A model description' });
  });

  it('includes id and drops type field', () => {
    const result = toHasuraInput(
      { id: 'https://w3id.org/okn/i/mint/some-model', type: ['Model'] },
      modelsConfig,
    );
    expect(result).toHaveProperty('id', 'https://w3id.org/okn/i/mint/some-model');
    expect(result).not.toHaveProperty('type');
  });

  it('includes keywords -- valid column on modelcatalog_software', () => {
    const result = toHasuraInput({ keywords: ['hydrology', 'water'] }, modelsConfig);
    expect(result).toHaveProperty('keywords');
  });
});

describe('toHasuraInput - softwareversions resource (modelcatalog_software_version table)', () => {
  const svConfig = getResourceConfig('softwareversions')!;

  it('includes shortDescription -- valid column on modelcatalog_software_version', () => {
    const result = toHasuraInput({ shortDescription: ['A brief description'] }, svConfig);
    expect(result).toHaveProperty('short_description', 'A brief description');
  });

  it('drops hasModelCategory -- relationship on versions config, handled separately', () => {
    const result = toHasuraInput(
      { hasModelCategory: [{ id: 'http://example.org/cat1', label: ['Economy'] }] },
      svConfig,
    );
    // hasModelCategory is in svConfig.relationships so it should be skipped
    expect(result).not.toHaveProperty('has_model_category');
  });

  it('includes label and description', () => {
    const result = toHasuraInput(
      { label: ['Version 1.0'], description: ['Version description'] },
      svConfig,
    );
    expect(result).toEqual({ label: 'Version 1.0', description: 'Version description' });
  });
});
