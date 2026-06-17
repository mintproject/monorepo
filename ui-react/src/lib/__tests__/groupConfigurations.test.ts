import { describe, expect, it } from 'vitest';

import { groupConfigurations, type SearchConfigurationRow } from '@/lib/groupConfigurations';

const sw = (id: string, label: string) => ({ id, label });

function config(
  id: string,
  label: string,
  software: { id: string; label: string },
  versionId: string | null = 'v1',
): SearchConfigurationRow {
  return {
    id,
    label,
    model_configuration_id: null,
    software_version: { version_id: versionId, software },
    parent_configuration: null,
  };
}

function setup(
  id: string,
  label: string,
  parentId: string,
  parentLabel: string,
  software: { id: string; label: string },
  versionId: string | null = 'v1',
): SearchConfigurationRow {
  return {
    id,
    label,
    model_configuration_id: parentId,
    software_version: null,
    parent_configuration: {
      id: parentId,
      label: parentLabel,
      software_version: { version_id: versionId, software },
    },
  };
}

describe('groupConfigurations', () => {
  it('groups a config-only row under its model', () => {
    const groups = groupConfigurations([config('c1', 'Calibration', sw('m1', 'MODFLOW'))]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ softwareId: 'm1', softwareLabel: 'MODFLOW' });
    expect(groups[0]!.configs).toHaveLength(1);
    expect(groups[0]!.configs[0]).toMatchObject({
      id: 'c1',
      label: 'Calibration',
      versionId: 'v1',
      synthesized: false,
      setups: [],
    });
  });

  it('nests a setup under its matched parent config (not synthesized)', () => {
    const groups = groupConfigurations([
      config('c1', 'Calibration', sw('m1', 'MODFLOW')),
      setup('s1', 'Travis Co.', 'c1', 'Calibration', sw('m1', 'MODFLOW')),
    ]);
    const cfg = groups[0]!.configs[0]!;
    expect(cfg.synthesized).toBe(false);
    expect(cfg.setups).toEqual([{ id: 's1', label: 'Travis Co.' }]);
  });

  it('synthesizes a parent config when only the setup matches', () => {
    const groups = groupConfigurations([
      setup('s1', 'Travis Co.', 'c1', 'Calibration', sw('m1', 'MODFLOW')),
    ]);
    expect(groups).toHaveLength(1);
    const cfg = groups[0]!.configs[0]!;
    expect(cfg).toMatchObject({ id: 'c1', label: 'Calibration', synthesized: true });
    expect(cfg.setups).toEqual([{ id: 's1', label: 'Travis Co.' }]);
  });

  it('keeps a config with zero setups visible', () => {
    const groups = groupConfigurations([
      config('c1', 'Forecast', sw('m1', 'MODFLOW')),
      config('c2', 'Calibration', sw('m1', 'MODFLOW')),
    ]);
    expect(groups[0]!.configs.map((c) => c.label)).toEqual(['Calibration', 'Forecast']);
    expect(groups[0]!.configs.every((c) => c.setups.length === 0)).toBe(true);
  });

  it('upgrades a synthesized parent if its real config row is also present', () => {
    // setup appears before its parent config in the result set
    const groups = groupConfigurations([
      setup('s1', 'Travis Co.', 'c1', 'Calibration', sw('m1', 'MODFLOW')),
      config('c1', 'Calibration', sw('m1', 'MODFLOW')),
    ]);
    const cfg = groups[0]!.configs[0]!;
    expect(cfg.synthesized).toBe(false);
    expect(cfg.setups).toHaveLength(1);
  });

  it('sorts groups, configs, and setups by label', () => {
    const groups = groupConfigurations([
      config('cz', 'Zeta', sw('m2', 'Zephyr')),
      config('ca', 'Alpha', sw('m1', 'Acme')),
      setup('s2', 'Beta region', 'ca', 'Alpha', sw('m1', 'Acme')),
      setup('s1', 'Alpha region', 'ca', 'Alpha', sw('m1', 'Acme')),
    ]);
    expect(groups.map((g) => g.softwareLabel)).toEqual(['Acme', 'Zephyr']);
    expect(groups[0]!.configs[0]!.setups.map((s) => s.label)).toEqual([
      'Alpha region',
      'Beta region',
    ]);
  });
});
