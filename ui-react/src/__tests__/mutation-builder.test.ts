import { describe, it, expect } from 'vitest';
import {
  buildAddInputVariables,
  buildAddOutputVariables,
  buildAddParameterVariables,
  assignPositions,
  diffInputRows,
  diffParameterRows,
  type InputRow,
  type PresentationRow,
  type ParameterRow,
} from '../lib/mutation-builder';
import type {
  AddConfigurationInputMutationVariables,
  Modelcatalog_Dataset_Specification_Presentation_Insert_Input,
} from '../graphql/generated/graphql';

// ─── Test fixtures ────────────────────────────────────────────────────────────

const MINT_URI_PATTERN = /^https:\/\/w3id\.org\/okn\/i\/mint\/[0-9a-f-]{36}$/;

function makePresentation(overrides: Partial<PresentationRow> = {}): PresentationRow {
  return {
    standardVariable: {
      id: 'https://w3id.org/okn/i/mint/sv-precip',
      label: 'Precipitation',
    },
    unit: {
      id: 'https://w3id.org/okn/i/mint/unit-mm',
      label: 'mm/day',
    },
    ...overrides,
  };
}

function makeInputRow(overrides: Partial<InputRow> = {}): InputRow {
  return {
    label: 'Precipitation',
    description: 'Daily precipitation data',
    hasFormat: 'CSV',
    position: 0,
    isOptional: false,
    presentations: [makePresentation()],
    ...overrides,
  };
}

/** Normalize the presentations mutation variable (array | single) to an array. */
function inserts(
  presentations: AddConfigurationInputMutationVariables['presentations'],
): Modelcatalog_Dataset_Specification_Presentation_Insert_Input[] {
  return Array.isArray(presentations) ? presentations : [presentations];
}

function makeParameterRow(overrides: Partial<ParameterRow> = {}): ParameterRow {
  return {
    label: 'Time Step',
    description: 'Simulation time step in days',
    hasDataType: 'float',
    hasDefaultValue: '1.0',
    hasMinimumAcceptedValue: '0.1',
    hasMaximumAcceptedValue: '7.0',
    position: 0,
    ...overrides,
  };
}

// ─── buildAddInputVariables ───────────────────────────────────────────────────

describe('buildAddInputVariables', () => {
  it('generates URIs for new inputs and each presentation', () => {
    const configId = 'https://w3id.org/okn/i/mint/config-1';
    const row = makeInputRow();
    const vars = buildAddInputVariables(configId, row);

    expect(vars.configurationId).toBe(configId);
    expect(vars.inputId).toMatch(MINT_URI_PATTERN);
    const data = inserts(vars.presentations);
    expect(data[0]?.presentation?.data?.id).toMatch(MINT_URI_PATTERN);
    expect(vars.inputId).not.toBe(data[0]?.presentation?.data?.id);
  });

  it('uses existingId when present (edit mode)', () => {
    const existingDsId = 'https://w3id.org/okn/i/mint/existing-ds';
    const existingVpId = 'https://w3id.org/okn/i/mint/existing-vp';
    const row = makeInputRow({
      existingId: existingDsId,
      presentations: [makePresentation({ existingPresentationId: existingVpId })],
    });
    const vars = buildAddInputVariables('config-1', row);

    expect(vars.inputId).toBe(existingDsId);
    expect(inserts(vars.presentations)[0]?.presentation?.data?.id).toBe(existingVpId);
  });

  it('maps all scalar fields correctly', () => {
    const row = makeInputRow({
      label: 'Soil Moisture',
      description: 'Volumetric soil moisture content',
      hasFormat: 'NetCDF',
      isOptional: true,
      position: 2,
    });
    const vars = buildAddInputVariables('config-1', row);

    expect(vars.inputLabel).toBe('Soil Moisture');
    expect(vars.inputDescription).toBe('Volumetric soil moisture content');
    expect(vars.hasFormat).toBe('NetCDF');
    expect(vars.isOptional).toBe(true);
    expect(vars.position).toBe(2);
  });

  it('maps standard variable and unit FK ids onto the presentation', () => {
    const row = makeInputRow();
    const data = inserts(buildAddInputVariables('config-1', row).presentations)[0]?.presentation
      ?.data;

    expect(data?.has_standard_variable).toBe('https://w3id.org/okn/i/mint/sv-precip');
    expect(data?.uses_unit).toBe('https://w3id.org/okn/i/mint/unit-mm');
  });

  it('creates one presentation entry per variable (zero, one, or many)', () => {
    const row = makeInputRow({
      presentations: [
        makePresentation({ standardVariable: { id: 'sv-1', label: 'A' } }),
        makePresentation({ standardVariable: { id: 'sv-2', label: 'B' } }),
        makePresentation({ standardVariable: { id: 'sv-3', label: 'C' } }),
      ],
    });
    const data = inserts(buildAddInputVariables('config-1', row).presentations);
    expect(data).toHaveLength(3);
    expect(data.map((d) => d.presentation?.data?.has_standard_variable)).toEqual([
      'sv-1',
      'sv-2',
      'sv-3',
    ]);
  });

  it('emits zero presentations when the input has no variables', () => {
    const row = makeInputRow({ presentations: [] });
    expect(inserts(buildAddInputVariables('config-1', row).presentations)).toHaveLength(0);
  });

  it('drops fully-empty presentation rows (no name, no SV, no unit)', () => {
    const row = makeInputRow({
      presentations: [
        makePresentation({ standardVariable: { id: 'sv-1', label: 'Keep' } }),
        { standardVariable: null, unit: null }, // empty → dropped
      ],
    });
    const data = inserts(buildAddInputVariables('config-1', row).presentations);
    expect(data).toHaveLength(1);
    expect(data[0]?.presentation?.data?.has_standard_variable).toBe('sv-1');
  });

  it('passes null for a presentation with no standard variable but a unit', () => {
    const row = makeInputRow({
      presentations: [makePresentation({ standardVariable: null })],
    });
    const data = inserts(buildAddInputVariables('config-1', row).presentations)[0]?.presentation
      ?.data;
    expect(data?.has_standard_variable).toBeNull();
    expect(data?.uses_unit).toBe('https://w3id.org/okn/i/mint/unit-mm');
  });

  it('derives presentation label from the standard variable', () => {
    const row = makeInputRow({
      label: 'Weather file',
      presentations: [
        makePresentation({
          standardVariable: { id: 'sv-1', label: 'Precipitation' },
        }),
      ],
    });
    const data = inserts(buildAddInputVariables('config-1', row).presentations)[0]?.presentation
      ?.data;
    expect(data?.label).toBe('Precipitation');
  });

  it('falls back to the input label when the standard variable is blank', () => {
    const row = makeInputRow({
      label: 'Weather file',
      presentations: [makePresentation({ standardVariable: null })],
    });
    const data = inserts(buildAddInputVariables('config-1', row).presentations)[0]?.presentation
      ?.data;
    expect(data?.label).toBe('Weather file');
  });

  it('leaves long/short names null (the presentation is hidden from the user)', () => {
    const row = makeInputRow({
      presentations: [
        makePresentation({ standardVariable: { id: 'sv-1', label: 'Precipitation' } }),
      ],
    });
    const data = inserts(buildAddInputVariables('config-1', row).presentations)[0]?.presentation
      ?.data;
    expect(data?.has_long_name).toBeNull();
    expect(data?.has_short_name).toBeNull();
  });
});

// ─── buildAddOutputVariables ──────────────────────────────────────────────────

describe('buildAddOutputVariables', () => {
  it('generates URIs for new outputs and presentations', () => {
    const row = makeInputRow({ isOptional: false });
    const vars = buildAddOutputVariables('config-1', row);

    expect(vars.outputId).toMatch(MINT_URI_PATTERN);
    expect(inserts(vars.presentations)[0]?.presentation?.data?.id).toMatch(MINT_URI_PATTERN);
  });

  it('maps output fields correctly', () => {
    const row = makeInputRow({ label: 'Runoff', hasFormat: 'GeoTIFF', position: 1 });
    const vars = buildAddOutputVariables('config-1', row);

    expect(vars.outputLabel).toBe('Runoff');
    expect(vars.hasFormat).toBe('GeoTIFF');
    expect(vars.position).toBe(1);
  });

  it('does not include isOptional (outputs have no optionality)', () => {
    const row = makeInputRow();
    const vars = buildAddOutputVariables('config-1', row);
    // OutputMutationVariables should not have isOptional — if it does, that's a type error
    expect('isOptional' in vars).toBe(false);
  });
});

// ─── buildAddParameterVariables ───────────────────────────────────────────────

describe('buildAddParameterVariables', () => {
  it('generates URI for new parameter when no existingId', () => {
    const row = makeParameterRow();
    const vars = buildAddParameterVariables('config-1', row);
    expect(vars.parameterId).toMatch(MINT_URI_PATTERN);
  });

  it('uses existingId when present', () => {
    const existingId = 'https://w3id.org/okn/i/mint/existing-param';
    const row = makeParameterRow({ existingId });
    const vars = buildAddParameterVariables('config-1', row);
    expect(vars.parameterId).toBe(existingId);
  });

  it('maps all parameter fields', () => {
    const row = makeParameterRow({
      label: 'Alpha',
      description: 'Calibration constant',
      hasDataType: 'float',
      hasDefaultValue: '0.5',
      hasMinimumAcceptedValue: '0.0',
      hasMaximumAcceptedValue: '1.0',
      hasFixedValue: undefined,
      hasAcceptedValues: ['0.1', '0.5', '1.0'],
      position: 3,
      parameterType: 'calibration',
    });
    const vars = buildAddParameterVariables('config-1', row);

    expect(vars.label).toBe('Alpha');
    expect(vars.description).toBe('Calibration constant');
    expect(vars.hasDataType).toBe('float');
    expect(vars.hasDefaultValue).toBe('0.5');
    expect(vars.hasMinimumAcceptedValue).toBe('0.0');
    expect(vars.hasMaximumAcceptedValue).toBe('1.0');
    expect(vars.hasAcceptedValues).toEqual(['0.1', '0.5', '1.0']);
    expect(vars.position).toBe(3);
    expect(vars.parameterType).toBe('calibration');
  });
});

// ─── assignPositions ──────────────────────────────────────────────────────────

describe('assignPositions', () => {
  it('assigns sequential 0-indexed positions', () => {
    const rows = [makeInputRow(), makeInputRow(), makeInputRow()];
    const result = assignPositions(rows);
    expect(result.map((r) => r.position)).toEqual([0, 1, 2]);
  });

  it('overwrites existing position values', () => {
    const rows = [makeInputRow({ position: 99 }), makeInputRow({ position: 0 })];
    const result = assignPositions(rows);
    expect(result.map((r) => r.position)).toEqual([0, 1]);
  });

  it('returns empty array for empty input', () => {
    expect(assignPositions([])).toEqual([]);
  });
});

// ─── diffInputRows ────────────────────────────────────────────────────────────

describe('diffInputRows', () => {
  it('identifies new rows without existingId as toAdd', () => {
    const orig: InputRow[] = [];
    const modified = [makeInputRow()];
    const { toAdd, toRemove, toUpdate } = diffInputRows(orig, modified);

    expect(toAdd).toHaveLength(1);
    expect(toRemove).toHaveLength(0);
    expect(toUpdate).toHaveLength(0);
  });

  it('identifies missing existingIds as toRemove', () => {
    const orig = [makeInputRow({ existingId: 'https://id/ds-1' })];
    const modified: InputRow[] = [];
    const { toAdd, toRemove, toUpdate } = diffInputRows(orig, modified);

    expect(toAdd).toHaveLength(0);
    expect(toRemove).toContain('https://id/ds-1');
    expect(toUpdate).toHaveLength(0);
  });

  it('identifies changed rows as toUpdate', () => {
    const orig = [makeInputRow({ existingId: 'https://id/ds-1', label: 'Old Label' })];
    const modified = [makeInputRow({ existingId: 'https://id/ds-1', label: 'New Label' })];
    const { toAdd, toRemove, toUpdate } = diffInputRows(orig, modified);

    expect(toAdd).toHaveLength(0);
    expect(toRemove).toHaveLength(0);
    expect(toUpdate).toHaveLength(1);
    expect(toUpdate[0]!.label).toBe('New Label');
  });

  it('does not mark unchanged rows as toUpdate', () => {
    const row = makeInputRow({ existingId: 'https://id/ds-1' });
    const { toAdd, toRemove, toUpdate } = diffInputRows([row], [{ ...row }]);

    expect(toAdd).toHaveLength(0);
    expect(toRemove).toHaveLength(0);
    expect(toUpdate).toHaveLength(0);
  });

  it('detects standard variable change as update', () => {
    const orig = [
      makeInputRow({
        existingId: 'https://id/ds-1',
        presentations: [makePresentation({ standardVariable: { id: 'sv-1', label: 'SV 1' } })],
      }),
    ];
    const modified = [
      makeInputRow({
        existingId: 'https://id/ds-1',
        presentations: [makePresentation({ standardVariable: { id: 'sv-2', label: 'SV 2' } })],
      }),
    ];
    const { toUpdate } = diffInputRows(orig, modified);
    expect(toUpdate).toHaveLength(1);
  });

  it('handles mixed add/remove/update in one call', () => {
    const orig: InputRow[] = [
      makeInputRow({ existingId: 'https://id/ds-1', label: 'Keep' }),
      makeInputRow({ existingId: 'https://id/ds-2', label: 'Old' }),
      makeInputRow({ existingId: 'https://id/ds-3', label: 'Remove' }),
    ];
    const modified: InputRow[] = [
      makeInputRow({ existingId: 'https://id/ds-1', label: 'Keep' }),
      makeInputRow({ existingId: 'https://id/ds-2', label: 'Updated' }),
      makeInputRow({ label: 'New Input' }), // no existingId = new
    ];
    const { toAdd, toRemove, toUpdate } = diffInputRows(orig, modified);

    expect(toAdd).toHaveLength(1);
    expect(toRemove).toContain('https://id/ds-3');
    expect(toUpdate).toHaveLength(1);
    expect(toUpdate[0]!.label).toBe('Updated');
  });
});

// ─── diffParameterRows ────────────────────────────────────────────────────────

describe('diffParameterRows', () => {
  it('identifies new parameters as toAdd', () => {
    const { toAdd } = diffParameterRows([], [makeParameterRow()]);
    expect(toAdd).toHaveLength(1);
  });

  it('identifies removed parameters as toRemove', () => {
    const orig = [makeParameterRow({ existingId: 'https://id/param-1' })];
    const { toRemove } = diffParameterRows(orig, []);
    expect(toRemove).toContain('https://id/param-1');
  });

  it('detects default value change as update', () => {
    const orig = [makeParameterRow({ existingId: 'https://id/param-1', hasDefaultValue: '1.0' })];
    const modified = [
      makeParameterRow({ existingId: 'https://id/param-1', hasDefaultValue: '2.0' }),
    ];
    const { toUpdate } = diffParameterRows(orig, modified);
    expect(toUpdate).toHaveLength(1);
  });
});
