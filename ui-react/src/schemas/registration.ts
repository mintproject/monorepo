/**
 * Zod validation schemas for the ModelRegistrationWizard.
 *
 * SoftwareStep: Software entity fields
 * VersionStep: SoftwareVersion entity fields
 *
 * The ConfigurationStep reuses configurationFormSchema from ./configuration.ts
 *
 * See: .planning/design/DESIGN-DOCUMENT.md §5.6
 */
import { z } from 'zod';

// ─── Software Step ────────────────────────────────────────────────────────────

export const SOFTWARE_TYPE_MODEL = 'https://w3id.org/okn/o/sdm#Model';
export const SOFTWARE_TYPE_EMULATOR = 'https://w3id.org/okn/o/sdm#Emulator';

export const softwareStepSchema = z.object({
  label: z.string().min(1, 'Model name is required'),
  description: z.string().optional(),
  keywords: z.string().optional(),
  license: z.string().optional(),
  website: z.string().url('Enter a valid URL').optional().or(z.literal('')),
  type: z.string().min(1, 'Software type is required').default(SOFTWARE_TYPE_MODEL),
});

export type SoftwareStepSchema = z.infer<typeof softwareStepSchema>;

// ─── Version Step ─────────────────────────────────────────────────────────────

export const versionStepSchema = z.object({
  versionId: z.string().optional(),
  label: z.string().min(1, 'Version label is required'),
  description: z.string().optional(),
  hasUsageNotes: z.string().optional(),
  hasSourceCode: z.string().url('Enter a valid URL').optional().or(z.literal('')),
});

export type VersionStepSchema = z.infer<typeof versionStepSchema>;

// ─── Combined wizard form ─────────────────────────────────────────────────────

export const registrationWizardSchema = z.object({
  software: softwareStepSchema,
  version: versionStepSchema,
});

export type RegistrationWizardSchema = z.infer<typeof registrationWizardSchema>;

export function emptySoftwareStep(): SoftwareStepSchema {
  return {
    label: '',
    description: '',
    keywords: '',
    license: '',
    website: '',
    type: SOFTWARE_TYPE_MODEL,
  };
}

export function emptyVersionStep(): VersionStepSchema {
  return {
    versionId: '',
    label: '',
    description: '',
    hasUsageNotes: '',
    hasSourceCode: '',
  };
}
