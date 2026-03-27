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

// ============================================================================
// Default type assignment: service layer uses resourceConfig.typeUri
// ============================================================================
// These tests document the contract: toHasuraInput strips the type field from
// the request body, and the service.ts create() method is responsible for
// conditionally setting input['type'] = resourceConfig.typeUri only when
// resourceConfig.hasuraTable === 'modelcatalog_software'.
//
// Only modelcatalog_software has a `type` column in the database. All other
// tables (modelcatalog_model_configuration, modelcatalog_software_version, etc.)
// lack this column and must NOT receive a type field in INSERT inputs.

describe('default type assignment via resourceConfig.typeUri', () => {
  it('resourceConfig for models has typeUri = https://w3id.org/okn/o/sdm#Model', () => {
    const config = getResourceConfig('models')!;
    expect(config.typeUri).toBe('https://w3id.org/okn/o/sdm#Model');
  });

  it('resourceConfig for empiricalmodels has typeUri = https://w3id.org/okn/o/sdm#EmpiricalModel', () => {
    const config = getResourceConfig('empiricalmodels')!;
    expect(config.typeUri).toBe('https://w3id.org/okn/o/sdm#EmpiricalModel');
  });

  it('resourceConfig for softwareversions has typeUri = https://w3id.org/okn/o/sd#SoftwareVersion', () => {
    const config = getResourceConfig('softwareversions')!;
    expect(config.typeUri).toBe('https://w3id.org/okn/o/sd#SoftwareVersion');
  });

  // ---- Conditional type assignment scope ----

  it('models has hasuraTable === modelcatalog_software, so type SHOULD be assigned on create', () => {
    const config = getResourceConfig('models')!;
    expect(config.hasuraTable).toBe('modelcatalog_software');
  });

  it('softwares has hasuraTable === modelcatalog_software, so type SHOULD be assigned on create', () => {
    const config = getResourceConfig('softwares')!;
    expect(config.hasuraTable).toBe('modelcatalog_software');
  });

  it('modelconfigurations has hasuraTable !== modelcatalog_software -- type must NOT be assigned', () => {
    const config = getResourceConfig('modelconfigurations')!;
    expect(config.hasuraTable).not.toBe('modelcatalog_software');
    // Specifically it uses modelcatalog_model_configuration which has no type column
    expect(config.hasuraTable).toBe('modelcatalog_model_configuration');
  });

  it('softwareversions has hasuraTable !== modelcatalog_software -- type must NOT be assigned', () => {
    const config = getResourceConfig('softwareversions')!;
    expect(config.hasuraTable).not.toBe('modelcatalog_software');
    expect(config.hasuraTable).toBe('modelcatalog_software_version');
  });

  it('simulates create() for models: type IS assigned because hasuraTable === modelcatalog_software', () => {
    const config = getResourceConfig('models')!;
    const input = toHasuraInput({ label: ['Test'], type: ['Model'] }, config);
    expect(input).not.toHaveProperty('type');
    // Simulate the conditional in service.ts create():
    if (config.hasuraTable === 'modelcatalog_software') {
      input['type'] = config.typeUri;
    }
    expect(input['type']).toBe('https://w3id.org/okn/o/sdm#Model');
  });

  it('simulates create() for modelconfigurations: type is NOT assigned -- table lacks type column', () => {
    const config = getResourceConfig('modelconfigurations')!;
    const input = toHasuraInput({ label: ['Test Config'] }, config);
    // Simulate the conditional in service.ts create():
    if (config.hasuraTable === 'modelcatalog_software') {
      input['type'] = config.typeUri;
    }
    // type must not be in the Hasura INSERT input for modelconfiguration
    expect(input).not.toHaveProperty('type');
  });

  it('simulates create() for softwareversions: type is NOT assigned -- table lacks type column', () => {
    const config = getResourceConfig('softwareversions')!;
    const input = toHasuraInput({ label: ['v1.0'] }, config);
    // Simulate the conditional in service.ts create():
    if (config.hasuraTable === 'modelcatalog_software') {
      input['type'] = config.typeUri;
    }
    // type must not be in the Hasura INSERT input for software_version
    expect(input).not.toHaveProperty('type');
  });

  it('toHasuraInput strips the type field so service layer can assign the canonical URI', () => {
    const config = getResourceConfig('models')!;
    // Body includes type as short name (API-level value)
    const input = toHasuraInput({ label: ['Test'], type: ['Model'] }, config);
    // toHasuraInput must not set type -- the service layer will assign it
    expect(input).not.toHaveProperty('type');
    // Simulating what service.ts create() does after toHasuraInput (conditional):
    if (config.hasuraTable === 'modelcatalog_software') {
      input['type'] = config.typeUri;
    }
    expect(input['type']).toBe('https://w3id.org/okn/o/sdm#Model');
  });

  it('toHasuraInput on empty body produces no type; service layer assigns canonical URI for software resources', () => {
    const config = getResourceConfig('models')!;
    // Body has no type field at all
    const input = toHasuraInput({ label: ['Test'] }, config);
    expect(input).not.toHaveProperty('type');
    // Service layer sets it (conditional on hasuraTable)
    if (config.hasuraTable === 'modelcatalog_software') {
      input['type'] = config.typeUri;
    }
    expect(input['type']).toBe('https://w3id.org/okn/o/sdm#Model');
  });
});
