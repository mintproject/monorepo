/**
 * Tests for promoting an archived file to an output dataset specification.
 *
 * The seed matters more than it looks: the publication matcher searches the
 * declared label against the archived file names, so a label that drifts from
 * the name binds the wrong file or no file at all (#267).
 */
import { describe, expect, it } from 'vitest';

import {
  formatFileSize,
  formatFromFileName,
  isFileDeclared,
  nextOutputPosition,
  outputRowFromFile,
} from '@/lib/promote-output';
import { buildAddOutputVariables } from '@/lib/mutation-builder';
import type { ExecutionFile } from '@/lib/ensemble-manager';

function file(name: string, overrides: Partial<ExecutionFile> = {}): ExecutionFile {
  return {
    name,
    path: `output/${name}`,
    size: 1024,
    url: `tapis://tacc.work/jobs/1/output/${name}`,
    ...overrides,
  };
}

describe('formatFromFileName', () => {
  it('reads the extension, lower-cased and without the dot', () => {
    expect(formatFromFileName('rainfall.TIF')).toBe('tif');
  });

  it('reads only the last extension', () => {
    expect(formatFromFileName('run.tar.gz')).toBe('gz');
  });

  it('returns an empty format for a name with no extension', () => {
    expect(formatFromFileName('README')).toBe('');
  });

  it('returns an empty format for a dotfile, not the whole name', () => {
    expect(formatFromFileName('.gitignore')).toBe('');
  });

  it('returns an empty format for a name that ends in a dot', () => {
    expect(formatFromFileName('output.')).toBe('');
  });
});

describe('outputRowFromFile', () => {
  it('seeds the label with the whole file name, so the matcher binds that file', () => {
    expect(outputRowFromFile(file('rainfall.tif'), 1).label).toBe('rainfall.tif');
  });

  it('seeds the format from the extension', () => {
    expect(outputRowFromFile(file('rainfall.tif'), 1).hasFormat).toBe('tif');
  });

  it('carries no variable presentation — only the label is required', () => {
    expect(outputRowFromFile(file('rainfall.tif'), 1).presentations).toEqual([]);
  });

  it('builds mutation variables Hasura accepts, with a generated id', () => {
    const vars = buildAddOutputVariables('http://config/1', outputRowFromFile(file('out.csv'), 2));
    expect(vars).toMatchObject({
      configurationId: 'http://config/1',
      outputLabel: 'out.csv',
      hasFormat: 'csv',
      position: 2,
      presentations: [],
    });
    expect(vars.outputId).toEqual(expect.any(String));
    expect(vars.outputId).not.toBe('');
  });
});

describe('nextOutputPosition', () => {
  // The Ensemble Manager reads a falsy position as an absent one and refuses
  // the whole run with "Input file missing position".
  it('is 1 for the first output, never 0', () => {
    expect(nextOutputPosition(0)).toBe(1);
  });

  it('follows the outputs already declared', () => {
    expect(nextOutputPosition(3)).toBe(4);
  });
});

describe('isFileDeclared', () => {
  it('matches a declared label case-insensitively', () => {
    expect(isFileDeclared(file('Rainfall.tif'), ['rainfall.tif'])).toBe(true);
  });

  it('ignores surrounding whitespace on the declared label', () => {
    expect(isFileDeclared(file('rainfall.tif'), ['  rainfall.tif '])).toBe(true);
  });

  it('does not match a different file', () => {
    expect(isFileDeclared(file('rainfall.tif'), ['runoff.tif'])).toBe(false);
  });

  it('is false when nothing is declared', () => {
    expect(isFileDeclared(file('rainfall.tif'), [])).toBe(false);
  });
});

describe('formatFileSize', () => {
  it('reports bytes below one kilobyte', () => {
    expect(formatFileSize(512)).toBe('512 B');
  });

  it('scales up to the largest fitting unit', () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('reports a dash for a size the server could not read', () => {
    expect(formatFileSize(Number.NaN)).toBe('—');
  });
});
