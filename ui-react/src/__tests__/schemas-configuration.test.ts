/**
 * Tests for Zod schemas in schemas/configuration.ts
 */
import { describe, it, expect } from 'vitest';
import {
  inputRowSchema,
  parameterRowSchema,
  configurationFormSchema,
  emptyInputRow,
  emptyParameterRow,
} from '@/schemas/configuration';

describe('inputRowSchema', () => {
  it('requires label', () => {
    const result = inputRowSchema.safeParse({
      label: '',
      position: 0,
      isOptional: false,
      presentations: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const labelError = result.error.errors.find((e) => e.path[0] === 'label');
      expect(labelError).toBeDefined();
    }
  });

  it('accepts a valid input row with multiple variable presentations', () => {
    const result = inputRowSchema.safeParse({
      label: 'Weather file',
      position: 0,
      isOptional: false,
      presentations: [
        {
          standardVariable: { id: 'https://example.org/sv/1', label: 'precip' },
          unit: { id: 'https://example.org/unit/1', label: 'mm' },
        },
        {
          standardVariable: { id: 'https://example.org/sv/2', label: 'temp' },
          unit: { id: 'https://example.org/unit/2', label: 'degC' },
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.presentations).toHaveLength(2);
    }
  });

  it('accepts an input row with zero presentations (zero standard variables)', () => {
    const result = inputRowSchema.safeParse({
      label: 'No-variable input',
      position: 0,
      presentations: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.presentations).toEqual([]);
    }
  });

  it('defaults isOptional to false', () => {
    const result = inputRowSchema.safeParse({
      label: 'Test',
      position: 0,
      presentations: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isOptional).toBe(false);
    }
  });

  it('defaults presentations to an empty array', () => {
    const result = inputRowSchema.safeParse({
      label: 'Test',
      position: 0,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.presentations).toEqual([]);
    }
  });

  it('defaults presentation standardVariable and unit to null', () => {
    const result = inputRowSchema.safeParse({
      label: 'Test',
      position: 0,
      presentations: [{}],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.presentations[0]?.standardVariable).toBeNull();
      expect(result.data.presentations[0]?.unit).toBeNull();
    }
  });
});

describe('parameterRowSchema', () => {
  it('requires label', () => {
    const result = parameterRowSchema.safeParse({ label: '', position: 0 });
    expect(result.success).toBe(false);
  });

  it('accepts a valid parameter row', () => {
    const result = parameterRowSchema.safeParse({
      label: 'Threshold',
      position: 1,
      hasDataType: 'float',
      hasDefaultValue: '0.5',
    });
    expect(result.success).toBe(true);
  });
});

describe('configurationFormSchema', () => {
  it('requires label', () => {
    const result = configurationFormSchema.safeParse({
      label: '',
      inputs: [],
      outputs: [],
      parameters: [],
      authors: [],
      regions: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const labelError = result.error.errors.find((e) => e.path[0] === 'label');
      expect(labelError).toBeDefined();
    }
  });

  it('accepts a valid full form', () => {
    const result = configurationFormSchema.safeParse({
      label: 'Test Config',
      description: 'A test',
      inputs: [
        {
          label: 'Precip',
          position: 0,
          isOptional: false,
          presentations: [],
        },
      ],
      outputs: [],
      parameters: [],
      authors: [{ id: 'person1', label: 'Alice' }],
      regions: [{ id: 'reg1', label: 'Ethiopia' }],
    });
    expect(result.success).toBe(true);
  });
});

describe('emptyInputRow', () => {
  it('creates a row with position set and zero variables', () => {
    const row = emptyInputRow(3);
    expect(row.position).toBe(3);
    expect(row.isOptional).toBe(false);
    expect(row.presentations).toEqual([]);
  });
});

describe('emptyParameterRow', () => {
  it('creates a row with position set', () => {
    const row = emptyParameterRow(5);
    expect(row.position).toBe(5);
    expect(row.label).toBe('');
  });
});
