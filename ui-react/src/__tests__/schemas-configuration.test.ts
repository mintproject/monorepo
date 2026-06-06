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
      standardVariable: null,
      unit: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const labelError = result.error.errors.find((e) => e.path[0] === 'label');
      expect(labelError).toBeDefined();
    }
  });

  it('accepts a valid input row with standard variable and unit', () => {
    const result = inputRowSchema.safeParse({
      label: 'Precipitation',
      position: 0,
      isOptional: false,
      standardVariable: { id: 'https://example.org/sv/1', label: 'precip' },
      unit: { id: 'https://example.org/unit/1', label: 'mm' },
    });
    expect(result.success).toBe(true);
  });

  it('defaults isOptional to false', () => {
    const result = inputRowSchema.safeParse({
      label: 'Test',
      position: 0,
      standardVariable: null,
      unit: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isOptional).toBe(false);
    }
  });

  it('defaults standardVariable and unit to null', () => {
    const result = inputRowSchema.safeParse({
      label: 'Test',
      position: 0,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.standardVariable).toBeNull();
      expect(result.data.unit).toBeNull();
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
          standardVariable: null,
          unit: null,
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
  it('creates a row with position set', () => {
    const row = emptyInputRow(3);
    expect(row.position).toBe(3);
    expect(row.isOptional).toBe(false);
    expect(row.standardVariable).toBeNull();
    expect(row.unit).toBeNull();
  });
});

describe('emptyParameterRow', () => {
  it('creates a row with position set', () => {
    const row = emptyParameterRow(5);
    expect(row.position).toBe(5);
    expect(row.label).toBe('');
  });
});
