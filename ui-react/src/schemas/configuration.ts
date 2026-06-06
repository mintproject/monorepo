/**
 * Zod validation schemas for the ConfigurationForm.
 *
 * Each schema corresponds to a section of the flattened form.
 * The configurationFormSchema is the root schema used with React Hook Form.
 *
 * See: .planning/design/DESIGN-DOCUMENT.md §6.4
 */
import { z } from 'zod';

// ─── Reference entity selections ─────────────────────────────────────────────

export const standardVariableSelectionSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  description: z.string().nullable().optional(),
});

export const unitSelectionSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
});

export const personSelectionSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
});

export const regionSelectionSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
});

// ─── Input / Output row ───────────────────────────────────────────────────────

export const inputRowSchema = z.object({
  /** Present in edit mode (existing DatasetSpecification id). */
  existingId: z.string().optional(),
  /** Present in edit mode (existing VariablePresentation id). */
  existingPresentationId: z.string().optional(),
  label: z.string().min(1, 'Input label is required'),
  description: z.string().optional(),
  hasFormat: z.string().optional(),
  hasDimensionality: z.number().int().min(0).optional(),
  position: z.number().int().min(0),
  /** First-class form field — stored on the junction row. */
  isOptional: z.boolean().default(false),
  standardVariable: standardVariableSelectionSchema.nullable().default(null),
  unit: unitSelectionSchema.nullable().default(null),
  /** Optional VariablePresentation overrides (collapsible section). */
  variableLabel: z.string().optional(),
  variableLongName: z.string().optional(),
  variableShortName: z.string().optional(),
});

export type InputRowSchema = z.infer<typeof inputRowSchema>;

// ─── Parameter row ────────────────────────────────────────────────────────────

export const parameterRowSchema = z.object({
  /** Present in edit mode. */
  existingId: z.string().optional(),
  label: z.string().min(1, 'Parameter label is required'),
  description: z.string().optional(),
  hasDataType: z.string().optional(),
  hasDefaultValue: z.string().optional(),
  hasMinimumAcceptedValue: z.string().optional(),
  hasMaximumAcceptedValue: z.string().optional(),
  hasFixedValue: z.string().optional(),
  hasAcceptedValues: z.array(z.string()).optional(),
  position: z.number().int().min(0),
  parameterType: z.string().optional(),
});

export type ParameterRowSchema = z.infer<typeof parameterRowSchema>;

// ─── Root form ────────────────────────────────────────────────────────────────

export const configurationFormSchema = z.object({
  label: z.string().min(1, 'Configuration name is required'),
  description: z.string().optional(),
  inputs: z.array(inputRowSchema),
  outputs: z.array(inputRowSchema),
  parameters: z.array(parameterRowSchema),
  authors: z.array(personSelectionSchema),
  regions: z.array(regionSelectionSchema),
});

export type ConfigurationFormSchema = z.infer<typeof configurationFormSchema>;

// ─── Default / empty row factories ───────────────────────────────────────────

export function emptyInputRow(position: number): InputRowSchema {
  return {
    label: '',
    description: '',
    hasFormat: '',
    position,
    isOptional: false,
    standardVariable: null,
    unit: null,
    variableLabel: '',
    variableLongName: '',
    variableShortName: '',
  };
}

export function emptyParameterRow(position: number): ParameterRowSchema {
  return {
    label: '',
    description: '',
    hasDataType: '',
    hasDefaultValue: '',
    hasMinimumAcceptedValue: '',
    hasMaximumAcceptedValue: '',
    hasFixedValue: '',
    hasAcceptedValues: [],
    position,
  };
}
