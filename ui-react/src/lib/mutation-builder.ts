/**
 * Mutation builder: transforms flattened form data into Hasura nested insert variables.
 *
 * This module handles the core innovation of the React UI:
 * converting a single form submission into the nested GraphQL mutation variables
 * that create DatasetSpecification + VariablePresentation + junction rows atomically.
 *
 * See: .planning/design/DESIGN-DOCUMENT.md §6.2–6.3 for design rationale.
 */

import { generateMintUri } from './uri';
import type {
  AddConfigurationInputMutationVariables,
  AddConfigurationOutputMutationVariables,
  AddConfigurationParameterMutationVariables,
} from '../graphql/generated/graphql';

// ─── Form data types ──────────────────────────────────────────────────────────

export interface StandardVariableSelection {
  id: string;
  label: string;
  description?: string | null;
}

export interface UnitSelection {
  id: string;
  label: string;
}

export interface PersonSelection {
  id: string;
  label: string;
}

export interface RegionSelection {
  id: string;
  label: string;
}

/** One row in the inputs or outputs field array of the configuration form. */
export interface InputRow {
  /** Existing DS id — present in edit mode, absent when adding a new row. */
  existingId?: string;
  /** Existing VariablePresentation id — present in edit mode. */
  existingPresentationId?: string;
  label: string;
  description?: string;
  hasFormat?: string;
  hasDimensionality?: number;
  position: number;
  isOptional: boolean;
  standardVariable: StandardVariableSelection | null;
  unit: UnitSelection | null;
  variableLabel?: string;
  variableLongName?: string;
  variableShortName?: string;
}

/** One row in the parameters field array. */
export interface ParameterRow {
  /** Existing parameter id — present in edit mode. */
  existingId?: string;
  label: string;
  description?: string;
  hasDataType?: string;
  hasDefaultValue?: string;
  hasMinimumAcceptedValue?: string;
  hasMaximumAcceptedValue?: string;
  hasFixedValue?: string;
  hasAcceptedValues?: string[];
  position: number;
  parameterType?: string;
}

/** Full form data for a model configuration. */
export interface ConfigurationFormData {
  label: string;
  description?: string;
  inputs: InputRow[];
  outputs: InputRow[];
  parameters: ParameterRow[];
  authors: PersonSelection[];
  regions: RegionSelection[];
}

// ─── Builders ────────────────────────────────────────────────────────────────

/**
 * Build mutation variables for adding a new configuration input.
 * Creates DatasetSpecification + VariablePresentation + junction rows in one shot.
 */
export function buildAddInputVariables(
  configurationId: string,
  row: InputRow
): AddConfigurationInputMutationVariables {
  const inputId = row.existingId ?? generateMintUri();
  const presentationId = row.existingPresentationId ?? generateMintUri();
  const presentationLabel = row.variableLabel ?? row.label;

  return {
    configurationId,
    isOptional: row.isOptional,
    inputId,
    inputLabel: row.label,
    inputDescription: row.description ?? null,
    hasFormat: row.hasFormat ?? null,
    hasDimensionality: row.hasDimensionality ?? null,
    position: row.position,
    presentationId,
    presentationLabel,
    hasLongName: row.variableLongName ?? null,
    hasShortName: row.variableShortName ?? null,
    hasStandardVariable: row.standardVariable?.id ?? null,
    usesUnit: row.unit?.id ?? null,
  };
}

/**
 * Build mutation variables for adding a new configuration output.
 * Creates DatasetSpecification + VariablePresentation + junction rows.
 */
export function buildAddOutputVariables(
  configurationId: string,
  row: InputRow
): AddConfigurationOutputMutationVariables {
  const outputId = row.existingId ?? generateMintUri();
  const presentationId = row.existingPresentationId ?? generateMintUri();
  const presentationLabel = row.variableLabel ?? row.label;

  return {
    configurationId,
    outputId,
    outputLabel: row.label,
    outputDescription: row.description ?? null,
    hasFormat: row.hasFormat ?? null,
    hasDimensionality: row.hasDimensionality ?? null,
    position: row.position,
    presentationId,
    presentationLabel,
    hasLongName: row.variableLongName ?? null,
    hasShortName: row.variableShortName ?? null,
    hasStandardVariable: row.standardVariable?.id ?? null,
    usesUnit: row.unit?.id ?? null,
  };
}

/**
 * Build mutation variables for adding a new parameter to a configuration.
 */
export function buildAddParameterVariables(
  configurationId: string,
  row: ParameterRow
): AddConfigurationParameterMutationVariables {
  const parameterId = row.existingId ?? generateMintUri();

  return {
    configurationId,
    parameterId,
    label: row.label,
    description: row.description ?? null,
    hasDataType: row.hasDataType ?? null,
    hasDefaultValue: row.hasDefaultValue ?? null,
    hasMinimumAcceptedValue: row.hasMinimumAcceptedValue ?? null,
    hasMaximumAcceptedValue: row.hasMaximumAcceptedValue ?? null,
    hasFixedValue: row.hasFixedValue ?? null,
    hasAcceptedValues: row.hasAcceptedValues ?? null,
    position: row.position,
    parameterType: row.parameterType ?? null,
  };
}

/**
 * Assign sequential position values to all rows in a field array.
 * Position is 0-indexed from the array order.
 */
export function assignPositions<T extends { position?: number }>(rows: T[]): T[] {
  return rows.map((row, index) => ({ ...row, position: index }));
}

/**
 * Compute the diff between original and modified input/output rows.
 *
 * Returns:
 * - toAdd: rows that are new (no existingId or existingId not in original)
 * - toRemove: existingIds from original that are missing in modified
 * - toUpdate: rows that exist in both but have changed fields
 */
export function diffInputRows(
  originalRows: InputRow[],
  modifiedRows: InputRow[]
): {
  toAdd: InputRow[];
  toRemove: string[];
  toUpdate: InputRow[];
} {
  const originalMap = new Map(
    originalRows.filter((r) => r.existingId).map((r) => [r.existingId!, r])
  );
  const modifiedMap = new Map(
    modifiedRows.filter((r) => r.existingId).map((r) => [r.existingId!, r])
  );

  const toAdd = modifiedRows.filter((r) => !r.existingId);

  const toRemove = [...originalMap.keys()].filter((id) => !modifiedMap.has(id));

  const toUpdate = modifiedRows.filter((r) => {
    if (!r.existingId) return false;
    const orig = originalMap.get(r.existingId);
    if (!orig) return false;
    // Detect any change in key fields
    return (
      orig.label !== r.label ||
      orig.description !== r.description ||
      orig.hasFormat !== r.hasFormat ||
      orig.isOptional !== r.isOptional ||
      orig.standardVariable?.id !== r.standardVariable?.id ||
      orig.unit?.id !== r.unit?.id ||
      orig.variableLabel !== r.variableLabel ||
      orig.variableLongName !== r.variableLongName ||
      orig.variableShortName !== r.variableShortName
    );
  });

  return { toAdd, toRemove, toUpdate };
}

/**
 * Compute the diff between original and modified parameter rows.
 */
export function diffParameterRows(
  originalRows: ParameterRow[],
  modifiedRows: ParameterRow[]
): {
  toAdd: ParameterRow[];
  toRemove: string[];
  toUpdate: ParameterRow[];
} {
  const originalMap = new Map(
    originalRows.filter((r) => r.existingId).map((r) => [r.existingId!, r])
  );
  const modifiedMap = new Map(
    modifiedRows.filter((r) => r.existingId).map((r) => [r.existingId!, r])
  );

  const toAdd = modifiedRows.filter((r) => !r.existingId);

  const toRemove = [...originalMap.keys()].filter((id) => !modifiedMap.has(id));

  const toUpdate = modifiedRows.filter((r) => {
    if (!r.existingId) return false;
    const orig = originalMap.get(r.existingId);
    if (!orig) return false;
    return (
      orig.label !== r.label ||
      orig.description !== r.description ||
      orig.hasDataType !== r.hasDataType ||
      orig.hasDefaultValue !== r.hasDefaultValue ||
      orig.hasMinimumAcceptedValue !== r.hasMinimumAcceptedValue ||
      orig.hasMaximumAcceptedValue !== r.hasMaximumAcceptedValue ||
      orig.hasFixedValue !== r.hasFixedValue
    );
  });

  return { toAdd, toRemove, toUpdate };
}
