/**
 * Standard Variable browse tree.
 *
 * Turns the flat option list into the two-level phenomenon → property tree the
 * guided picker navigates. Only CSDMS-grammar labels (`object__quantity`)
 * appear here; human-named and UUID labels are excluded — the picker routes
 * those through its flat "search all" fallback. Duplicate labels collapse to a
 * single property entry (first occurrence wins); the canonical record id is
 * resolved at render time via useVariableUnits.canonicalIdForLabel.
 */

import type { StandardVariableOption } from '@/components/autocomplete/StandardVariableCombobox';
import { humanizeStandardVariable, parseCsdmsName } from '@/lib/standard-variable-grammar';

export interface PropertyEntry {
  /** First-seen option id for this label; resolve to canonical at render time. */
  svId: string;
  /** Full machine label (e.g. `channel_water__volume_flow_rate`). */
  label: string;
  /** Humanized, sentence-cased property (e.g. `Volume flow rate`). */
  property: string;
  description: string | null;
}

export interface PhenomenonGroup {
  /** Humanized, sentence-cased phenomenon (e.g. `Channel water`). */
  phenomenon: string;
  properties: PropertyEntry[];
}

/** Build the phenomenon → property tree from grammar-named options. */
export function buildPhenomenonGroups(options: StandardVariableOption[]): PhenomenonGroup[] {
  const seenLabels = new Set<string>();
  const byPhenomenon = new Map<string, PropertyEntry[]>();

  for (const opt of options) {
    if (!parseCsdmsName(opt.label).isGrammar) continue;
    if (seenLabels.has(opt.label)) continue;
    seenLabels.add(opt.label);

    const { phenomenon, property } = humanizeStandardVariable(opt.label);
    const entry: PropertyEntry = {
      svId: opt.id,
      label: opt.label,
      property,
      description: opt.description ?? null,
    };
    const arr = byPhenomenon.get(phenomenon) ?? [];
    arr.push(entry);
    byPhenomenon.set(phenomenon, arr);
  }

  return [...byPhenomenon.entries()]
    .map(([phenomenon, properties]) => ({
      phenomenon,
      properties: [...properties].sort((a, b) => a.property.localeCompare(b.property)),
    }))
    .sort((a, b) => a.phenomenon.localeCompare(b.phenomenon));
}
