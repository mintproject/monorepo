import { describe, expect, it } from 'vitest';

import type { StandardVariableOption } from '@/components/autocomplete/StandardVariableCombobox';
import { buildPhenomenonGroups } from '@/lib/standard-variable-browse';

const options: StandardVariableOption[] = [
  { id: 'sv1', label: 'channel_water__volume_flow_rate', description: 'discharge' },
  { id: 'sv2', label: 'channel_water__discharge_coefficient', description: null },
  { id: 'sv3', label: 'air__temperature', description: 'air temp' },
  { id: 'sv3-dup', label: 'air__temperature', description: 'duplicate record' },
  { id: 'svX', label: 'Flame Length', description: 'human-named, no grammar' },
  { id: 'svU', label: '06100430-298a-49d7-9834-590783d62379', description: '' },
];

describe('buildPhenomenonGroups', () => {
  it('groups grammar labels by phenomenon, alphabetically', () => {
    const groups = buildPhenomenonGroups(options);
    expect(groups.map((g) => g.phenomenon)).toEqual(['Air', 'Channel water']);
  });

  it('humanizes and alpha-sorts properties within a phenomenon', () => {
    const groups = buildPhenomenonGroups(options);
    const channel = groups.find((g) => g.phenomenon === 'Channel water');
    expect(channel?.properties.map((p) => p.property)).toEqual([
      'Discharge coefficient',
      'Volume flow rate',
    ]);
  });

  it('collapses duplicate labels to one property entry (first wins)', () => {
    const groups = buildPhenomenonGroups(options);
    const air = groups.find((g) => g.phenomenon === 'Air');
    expect(air?.properties).toEqual([
      { svId: 'sv3', label: 'air__temperature', property: 'Temperature', description: 'air temp' },
    ]);
  });

  it('excludes non-grammar labels (human-named and UUID)', () => {
    const groups = buildPhenomenonGroups(options);
    const allLabels = groups.flatMap((g) => g.properties.map((p) => p.label));
    expect(allLabels).not.toContain('Flame Length');
    expect(allLabels).not.toContain('06100430-298a-49d7-9834-590783d62379');
  });
});
