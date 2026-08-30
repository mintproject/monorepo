/**
 * Zod validation schema for the config-first "Create a new model" form.
 *
 * UI terminology: Model = Configuration, Model Family = Software, Version = SoftwareVersion.
 * The configuration row editors (inputs/outputs/parameters) reuse schemas from ./configuration.ts.
 */
import { z } from 'zod';
import { inputRowSchema, parameterRowSchema, regionSelectionSchema } from '@/schemas/configuration';

// ─── Software type constants ──────────────────────────────────────────────────

export const SOFTWARE_TYPE_MODEL = 'https://w3id.org/okn/o/sdm#Model';
export const SOFTWARE_TYPE_EMULATOR = 'https://w3id.org/okn/o/sdm#Emulator';

// ─── Optional Model Family link ───────────────────────────────────────────────
// `none`     → standalone configuration (software_version_id = null)
// `existing` → link to a chosen Software+Version pair (versionId required — the
//              picker always lists pairs, and Configuration links via software_version_id)
// `new`      → create a Software + one SoftwareVersion, then link

export const modelFamilyLinkSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('none') }),
  z.object({
    mode: z.literal('existing'),
    softwareId: z.string().min(1),
    softwareLabel: z.string(),
    versionId: z.string().min(1, 'Choose a version'),
    versionLabel: z.string().optional(),
  }),
  z.object({
    mode: z.literal('new'),
    familyName: z.string().min(1, 'Family name is required'),
    versionName: z.string().optional(),
  }),
]);

export type ModelFamilyLink = z.infer<typeof modelFamilyLinkSchema>;

// ─── Root form schema ─────────────────────────────────────────────────────────

export const createModelSchema = z.object({
  label: z.string().min(1, 'Model name is required'),
  description: z.string().optional(),
  inputs: z.array(inputRowSchema),
  outputs: z.array(inputRowSchema),
  parameters: z.array(parameterRowSchema),
  // `isRegionSpecific` gates region selection: off (default) means the model is
  // non-spatial or works anywhere; on means it is calibrated for the picked regions.
  isRegionSpecific: z.boolean(),
  regions: z.array(regionSelectionSchema),
  license: z.string().optional(),
  website: z.string().url('Enter a valid URL').optional().or(z.literal('')),
  keywords: z.string().optional(),
  modelFamily: modelFamilyLinkSchema,
});

export type CreateModelSchema = z.infer<typeof createModelSchema>;

export function emptyCreateModel(): CreateModelSchema {
  return {
    label: '',
    description: '',
    inputs: [],
    outputs: [],
    parameters: [],
    isRegionSpecific: false,
    regions: [],
    license: '',
    website: '',
    keywords: '',
    modelFamily: { mode: 'none' },
  };
}
