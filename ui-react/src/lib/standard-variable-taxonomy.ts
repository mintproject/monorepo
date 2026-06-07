/**
 * Standard Variable taxonomy.
 *
 * Pure, framework-free helpers that derive a domain category from a standard
 * variable's SVO/CSDMS name grammar (`object__quantity`) and detect
 * "unnamed" labels (raw UUIDs or structureless strings) so the UI can demote
 * them. First-matching rule wins; rules are ordered so specific domains beat
 * cross-cutting tokens (e.g. Fire & Fuel before the soil/moisture overlap,
 * Soil before the hydrology rules).
 */

export type StandardVariableCategory =
  | 'Atmosphere & Climate'
  | 'Hydrology — Surface Water'
  | 'Hydrology — Groundwater'
  | 'Soil'
  | 'Fire & Fuel'
  | 'Land Cover & Vegetation'
  | 'Topography & Surface'
  | 'Energy & Carbon Flux'
  | 'Unnamed / Other';

/** Fixed display order for category groups; "Unnamed / Other" is always last. */
export const CATEGORY_ORDER: StandardVariableCategory[] = [
  'Atmosphere & Climate',
  'Hydrology — Surface Water',
  'Hydrology — Groundwater',
  'Soil',
  'Fire & Fuel',
  'Land Cover & Vegetation',
  'Topography & Surface',
  'Energy & Carbon Flux',
  'Unnamed / Other',
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for UUID-shaped, empty, or structureless (single-token) labels. */
export function isUnnamedLabel(label: string): boolean {
  const trimmed = label.trim();
  if (trimmed === '') return true;
  if (UUID_RE.test(trimmed)) return true;
  // A real SVO name has underscores; a human phrase has spaces. Neither => junk.
  if (!trimmed.includes('_') && !trimmed.includes(' ')) return true;
  return false;
}

interface CategoryRule {
  category: StandardVariableCategory;
  test: RegExp;
}

// Ordered: first match wins. Specific domains first; cross-cutting tokens
// (bare "moisture", "flux", "water") are deliberately omitted as triggers.
const RULES: CategoryRule[] = [
  { category: 'Fire & Fuel', test: /fire|fuel|_dead_|_live_|burn|flame|combust|\d+\s*hr_/i },
  { category: 'Soil', test: /soil|sediment|infiltration|porosity/i },
  { category: 'Hydrology — Groundwater', test: /groundwater|aquifer|water_table|recharge/i },
  {
    category: 'Hydrology — Surface Water',
    test: /surface_water|channel|stream|river|runoff|discharge|flood|lake|reservoir/i,
  },
  {
    category: 'Land Cover & Vegetation',
    test: /vegetation|canopy|crop|forest|biomass|\bleaf|\blai\b|ndvi|land_cover|land_use/i,
  },
  { category: 'Topography & Surface', test: /elevation|slope|terrain|topograph|\bdem\b/i },
  {
    category: 'Energy & Carbon Flux',
    test: /energy|\bheat|carbon|\bco2\b|evapotranspiration|latent|sensible/i,
  },
  {
    category: 'Atmosphere & Climate',
    test: /atmosphere|\bair|precipitation|wind|temperature|radiation|humidity|vapor/i,
  },
];

/** Map a standard variable to a domain category. */
export function categorizeStandardVariable(
  label: string,
  description?: string | null,
): StandardVariableCategory {
  if (isUnnamedLabel(label)) return 'Unnamed / Other';
  const haystack = `${label} ${description ?? ''}`;
  for (const rule of RULES) {
    if (rule.test.test(haystack)) return rule.category;
  }
  return 'Unnamed / Other';
}
