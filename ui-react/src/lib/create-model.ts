/**
 * Pure helpers that turn config-first form data into the create steps:
 *   1. optionally create a Model Family (Software + first Version)
 *   2. create the Configuration with a possibly-null software_version_id
 *
 * Network orchestration lives in CreateModelForm; these are pure + unit-tested.
 */
import { generateMintUri } from './uri';
import { SOFTWARE_TYPE_MODEL, type CreateModelSchema } from '@/schemas/registration';

export interface CreateModelFamilyVariables {
  softwareId: string;
  softwareLabel: string;
  softwareType: string;
  versionId: string;
  versionLabel: string;
}

/**
 * Build variables to create a new Software + one SoftwareVersion.
 * A version row is always created so the Configuration has something to link to;
 * its label falls back to the family name when the user left the version blank.
 */
export function buildCreateModelFamilyVariables(
  familyName: string,
  versionName: string | undefined,
): CreateModelFamilyVariables {
  return {
    softwareId: generateMintUri(),
    softwareLabel: familyName,
    softwareType: SOFTWARE_TYPE_MODEL,
    versionId: generateMintUri(),
    versionLabel: versionName?.trim() ? versionName.trim() : familyName,
  };
}

export interface SubmitPlan {
  /** Present only when a new Model Family must be created first. */
  createFamily: CreateModelFamilyVariables | null;
  /** The configuration's parent version id, or null for a standalone config. */
  softwareVersionId: string | null;
}

/**
 * Decide what the submit flow must do based on the chosen Model Family link.
 */
export function resolveSubmitPlan(data: CreateModelSchema): SubmitPlan {
  const family = data.modelFamily;

  if (family.mode === 'existing') {
    return { createFamily: null, softwareVersionId: family.versionId };
  }

  if (family.mode === 'new') {
    const createFamily = buildCreateModelFamilyVariables(family.familyName, family.versionName);
    return { createFamily, softwareVersionId: createFamily.versionId };
  }

  // mode === 'none' → standalone
  return { createFamily: null, softwareVersionId: null };
}
