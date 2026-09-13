/**
 * Promote an archived file to an output dataset specification.
 *
 * A Tapis application declares no output file type, so the Sync button leaves
 * the outputs of a model configuration empty and publication fails with 422
 * `NO_OUTPUTS_DECLARED`. The user repairs that after the first run: the
 * execution view lists what the job archived, and the user promotes the files
 * that are results (#261, #267).
 *
 * Two tiers live behind that. A file that matches a declared output becomes a
 * typed result and reaches CKAN. A file that matches nothing stays a raw
 * artifact, listed live from Tapis and stored nowhere. Promotion is how a user
 * moves a file from the second tier to the first.
 */
import type { ExecutionFile } from './ensemble-manager';
import type { InputRow } from './mutation-builder';

/**
 * The extension of a file name, lower-cased, without the dot.
 *
 * It becomes `has_format` on the dataset specification, which the Ensemble
 * Manager copies into `resource.type` and CKAN reads as `format`. A name with
 * no dot, or a dotfile such as `.gitignore`, has no extension — the format
 * stays empty rather than becoming the whole name.
 */
export function formatFromFileName(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toLowerCase();
}

/**
 * The output row that promotes one archived file.
 *
 * The label is the **whole file name**, extension included. The publication
 * matcher searches the declared label against the archived file names with
 * Fuse, so an exact name is the one seed that cannot bind the wrong file
 * (`matchTapisOutputsToMintOutputs` in mint-ensemble-manager).
 *
 * Only the label is required. The row carries no variable presentation: the
 * user adds the standard variable later, on the model configuration form.
 */
export function outputRowFromFile(file: ExecutionFile, position: number): InputRow {
  return {
    label: file.name,
    hasFormat: formatFromFileName(file.name),
    position,
    isOptional: false,
    presentations: [],
  };
}

/**
 * The position for the next promoted output.
 *
 * Position is 1-indexed, never 0 — the Ensemble Manager reads a falsy position
 * as an absent one and refuses the whole run (see `assignPositions`).
 */
export function nextOutputPosition(declaredOutputCount: number): number {
  return declaredOutputCount + 1;
}

/**
 * Is this file already declared as an output?
 *
 * The comparison is on the label, case-insensitively, because that is what the
 * matcher binds on. A promoted file must not be promoted twice: two declared
 * outputs with the same label would compete for the same archived file, and
 * one of them would publish nothing.
 */
export function isFileDeclared(file: ExecutionFile, declaredLabels: string[]): boolean {
  const name = file.name.trim().toLowerCase();
  return declaredLabels.some((label) => label.trim().toLowerCase() === name);
}

/** A file size in bytes, as a short human-readable string. */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}
