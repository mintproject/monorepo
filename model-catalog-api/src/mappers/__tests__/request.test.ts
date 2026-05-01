import { describe, it, expect } from 'vitest';
import { toHasuraInput, camelToSnake, buildJunctionInserts } from '../request.js';
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
    // Specifically it uses modelcatalog_configuration which has no type column
    expect(config.hasuraTable).toBe('modelcatalog_configuration');
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

// ============================================================================
// buildJunctionInserts
// ============================================================================

describe('buildJunctionInserts', () => {
  const modelsConfig = getResourceConfig('models')!;
  const svConfig = getResourceConfig('softwareversions')!;
  const causalConfig = getResourceConfig('causaldiagrams')!;

  it('Test 1: produces correct nested insert structure for existing category with full URI ID', () => {
    const body = {
      hasModelCategory: [{ id: 'https://w3id.org/okn/i/mint/Economy', label: ['Economy'] }],
    };
    const result = buildJunctionInserts(body, modelsConfig);
    expect(result).toHaveProperty('categories');
    const categories = result['categories'] as Record<string, unknown>;
    expect(categories).toHaveProperty('data');
    expect(categories).toHaveProperty('on_conflict');
    const onConflict = categories['on_conflict'] as Record<string, unknown>;
    expect(onConflict['constraint']).toBe('modelcatalog_software_category_pkey');
    expect(onConflict['update_columns']).toEqual([]);
    const data = categories['data'] as Record<string, unknown>[];
    expect(data).toHaveLength(1);
    const junctionRow = data[0] as Record<string, unknown>;
    expect(junctionRow).toHaveProperty('category');
    const category = junctionRow['category'] as Record<string, unknown>;
    expect(category).toHaveProperty('data');
    expect(category).toHaveProperty('on_conflict');
    const targetData = category['data'] as Record<string, unknown>;
    expect(targetData['id']).toBe('https://w3id.org/okn/i/mint/Economy');
    const targetConflict = category['on_conflict'] as Record<string, unknown>;
    expect(targetConflict['constraint']).toBe('modelcatalog_model_category_pkey');
    expect(targetConflict['update_columns']).toEqual(['label']);
  });

  it('Test 2: generates UUID-based ID with https prefix when no ID provided', () => {
    const body = {
      hasModelCategory: [{ label: ['New Category'] }],
    };
    const result = buildJunctionInserts(body, modelsConfig);
    const data = (result['categories'] as Record<string, unknown>)['data'] as Record<string, unknown>[];
    const junctionRow = data[0] as Record<string, unknown>;
    const category = junctionRow['category'] as Record<string, unknown>;
    const targetData = category['data'] as Record<string, unknown>;
    expect(targetData['id']).toMatch(/^https:\/\/w3id\.org\/okn\/i\/mint\/[0-9a-f-]{36}$/);
  });

  it('Test 3: normalizes array-of-strings to array-of-objects', () => {
    const body = {
      hasModelCategory: ['https://w3id.org/okn/i/mint/Economy'],
    };
    const result = buildJunctionInserts(body, modelsConfig);
    const data = (result['categories'] as Record<string, unknown>)['data'] as Record<string, unknown>[];
    expect(data).toHaveLength(1);
    const junctionRow = data[0] as Record<string, unknown>;
    const category = junctionRow['category'] as Record<string, unknown>;
    const targetData = category['data'] as Record<string, unknown>;
    expect(targetData['id']).toBe('https://w3id.org/okn/i/mint/Economy');
  });

  it('Test 4: prepends idPrefix to short IDs (no https prefix)', () => {
    const body = {
      hasModelCategory: ['some-uuid'],
    };
    const result = buildJunctionInserts(body, modelsConfig);
    const data = (result['categories'] as Record<string, unknown>)['data'] as Record<string, unknown>[];
    const junctionRow = data[0] as Record<string, unknown>;
    const category = junctionRow['category'] as Record<string, unknown>;
    const targetData = category['data'] as Record<string, unknown>;
    expect(targetData['id']).toBe('https://w3id.org/okn/i/mint/some-uuid');
  });

  it('Test 5: returns empty object when no junction fields are present in body', () => {
    const body = { label: ['Test Model'] };
    const result = buildJunctionInserts(body, modelsConfig);
    expect(result).toEqual({});
  });

  it('Test 6: skips relationships without junctionRelName (causaldiagrams hasPart)', () => {
    const body = {
      hasPart: [{ id: 'https://w3id.org/okn/i/mint/some-var' }],
    };
    const result = buildJunctionInserts(body, causalConfig);
    // hasPart has no junctionRelName, so it should be skipped
    expect(result).not.toHaveProperty('diagram_parts');
    expect(result).toEqual({});
  });

  it('Test 7: handles multiple items in array producing multiple junction row entries', () => {
    const body = {
      hasModelCategory: [
        { id: 'https://w3id.org/okn/i/mint/Economy' },
        { id: 'https://w3id.org/okn/i/mint/Agriculture' },
      ],
    };
    const result = buildJunctionInserts(body, modelsConfig);
    const data = (result['categories'] as Record<string, unknown>)['data'] as Record<string, unknown>[];
    expect(data).toHaveLength(2);
    const firstTarget = (data[0]['category'] as Record<string, unknown>)['data'] as Record<string, unknown>;
    const secondTarget = (data[1]['category'] as Record<string, unknown>)['data'] as Record<string, unknown>;
    expect(firstTarget['id']).toBe('https://w3id.org/okn/i/mint/Economy');
    expect(secondTarget['id']).toBe('https://w3id.org/okn/i/mint/Agriculture');
  });

  it('Test 8: existing toHasuraInput tests still pass (regression - scalar output unchanged)', () => {
    const result = toHasuraInput({ label: ['Test'], description: ['Desc'] }, modelsConfig);
    expect(result).toEqual({ label: 'Test', description: 'Desc' });
  });

  it('Test 9: maps camelCase scalar fields on nested objects to snake_case', () => {
    const body = {
      authors: [{ id: 'https://w3id.org/okn/i/mint/Person1', firstName: 'John', lastName: 'Doe' }],
    };
    const result = buildJunctionInserts(body, modelsConfig);
    const data = (result['authors'] as Record<string, unknown>)['data'] as Record<string, unknown>[];
    const personData = (data[0]['person'] as Record<string, unknown>)['data'] as Record<string, unknown>;
    expect(personData['id']).toBe('https://w3id.org/okn/i/mint/Person1');
    expect(personData).toHaveProperty('first_name', 'John');
    expect(personData).toHaveProperty('last_name', 'Doe');
  });

  it('Test 10: spreads is_optional=true from isOptional onto configuration_input junction row (D-21)', () => {
    const configConfig = getResourceConfig('modelconfigurations')!;
    const body = {
      hasInput: [
        { id: 'https://w3id.org/okn/i/mint/SomeDataset', isOptional: true }
      ],
    };
    const result = buildJunctionInserts(body, configConfig);
    const inputs = result['inputs'] as Record<string, unknown>;
    expect(inputs).toHaveProperty('data');
    const data = inputs['data'] as Record<string, unknown>[];
    expect(data).toHaveLength(1);
    const junctionRow = data[0] as Record<string, unknown>;
    // is_optional lives on the outer junction row (modelcatalog_configuration_input),
    // NOT inside junctionRow['input']['data']. Verify it is at the top level:
    expect(junctionRow).toHaveProperty('is_optional', true);
    // Nested entity data should NOT have is_optional:
    const nestedData = (junctionRow['input'] as Record<string, unknown>)['data'] as Record<string, unknown>;
    expect(nestedData).not.toHaveProperty('is_optional');
  });

  it('Test 11: omits is_optional from junction row when isOptional is absent in request body (D-22)', () => {
    const configConfig = getResourceConfig('modelconfigurations')!;
    const body = {
      hasInput: [
        { id: 'https://w3id.org/okn/i/mint/SomeDataset' }
      ],
    };
    const result = buildJunctionInserts(body, configConfig);
    const inputs = result['inputs'] as Record<string, unknown>;
    const data = inputs['data'] as Record<string, unknown>[];
    const junctionRow = data[0] as Record<string, unknown>;
    // When isOptional is not provided, the key should be absent (not defaulted to false)
    // so that Postgres applies its own column default:
    expect(junctionRow).not.toHaveProperty('is_optional');
  });
});
