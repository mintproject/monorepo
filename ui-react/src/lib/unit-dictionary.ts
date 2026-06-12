/**
 * Unit dictionary.
 *
 * `modelcatalog_unit` stores only `id` + a cryptic `label` (the symbol, e.g.
 * `m s-1`, `day/m^(1/3)`) — no human name and no physical dimension. This
 * finite, client-side map supplies both so the picker can show readable unit
 * names and group the full list by dimension. Entries are drawn from the units
 * actually present in the live catalog; extend as new symbols appear. Unknown
 * symbols are never hidden — they fall back to `{ name: symbol, dimension:
 * 'Other' }`.
 */

export type UnitDimension =
  | 'Temperature'
  | 'Length'
  | 'Speed'
  | 'Depth rate'
  | 'Volume flow'
  | 'Fraction'
  | 'Pressure'
  | 'Area'
  | 'Areal mass'
  | 'Mass'
  | 'Concentration'
  | 'Energy flux'
  | 'Roughness'
  | 'Time'
  | 'Date'
  | 'Code'
  | 'Other';

/** Fixed display order for dimension groups; `Other` is always last. */
export const DIMENSION_ORDER: UnitDimension[] = [
  'Temperature',
  'Length',
  'Speed',
  'Depth rate',
  'Volume flow',
  'Fraction',
  'Pressure',
  'Area',
  'Areal mass',
  'Mass',
  'Concentration',
  'Energy flux',
  'Roughness',
  'Time',
  'Date',
  'Code',
  'Other',
];

interface UnitMeta {
  name: string;
  dimension: UnitDimension;
}

export const UNIT_DICTIONARY: Record<string, UnitMeta> = {
  K: { name: 'kelvin', dimension: 'Temperature' },
  degC: { name: 'degrees Celsius', dimension: 'Temperature' },
  'degC/day': { name: '°C per day', dimension: 'Temperature' },
  m: { name: 'metres', dimension: 'Length' },
  cm: { name: 'centimetres', dimension: 'Length' },
  mm: { name: 'millimetres', dimension: 'Length' },
  foot: { name: 'feet', dimension: 'Length' },
  'm s-1': { name: 'metres per second', dimension: 'Speed' },
  'ft/min': { name: 'feet per minute', dimension: 'Speed' },
  'm day-1': { name: 'metres per day', dimension: 'Depth rate' },
  'm d-1': { name: 'metres per day', dimension: 'Depth rate' },
  'mm day-1': { name: 'millimetres per day', dimension: 'Depth rate' },
  'mm h-1': { name: 'millimetres per hour', dimension: 'Depth rate' },
  'cm h-1': { name: 'centimetres per hour', dimension: 'Depth rate' },
  'm3 s-1': { name: 'cubic metres per second', dimension: 'Volume flow' },
  'm^3/s': { name: 'cubic metres per second', dimension: 'Volume flow' },
  'm3 day-1': { name: 'cubic metres per day', dimension: 'Volume flow' },
  'm3 m-3': { name: 'volume water per volume soil', dimension: 'Fraction' },
  'cm3 cm-3': { name: 'volume per volume', dimension: 'Fraction' },
  '%': { name: 'percent', dimension: 'Fraction' },
  'g/100g': { name: 'grams per 100 g', dimension: 'Fraction' },
  'kg kg-1': { name: 'kg per kg', dimension: 'Fraction' },
  'm m-1': { name: 'metres per metre', dimension: 'Fraction' },
  Pa: { name: 'pascals', dimension: 'Pressure' },
  ha: { name: 'hectares', dimension: 'Area' },
  '1000ha': { name: 'thousand hectares', dimension: 'Area' },
  km2: { name: 'square kilometres', dimension: 'Area' },
  'm^2': { name: 'square metres', dimension: 'Area' },
  'kg ha-1': { name: 'kg per hectare', dimension: 'Areal mass' },
  't/ha': { name: 'tonnes per hectare', dimension: 'Areal mass' },
  'Mg ha-1': { name: 'megagrams per hectare', dimension: 'Areal mass' },
  kg: { name: 'kilograms', dimension: 'Mass' },
  Mg: { name: 'megagrams', dimension: 'Mass' },
  'metric ton': { name: 'metric tons', dimension: 'Mass' },
  ppm: { name: 'parts per million', dimension: 'Concentration' },
  'mg/L': { name: 'milligrams per litre', dimension: 'Concentration' },
  'g kg-1': { name: 'grams per kilogram', dimension: 'Concentration' },
  'g cm-3': { name: 'grams per cubic centimetre', dimension: 'Concentration' },
  'W m-2': { name: 'watts per square metre', dimension: 'Energy flux' },
  'MJ m-2 day-1': { name: 'MJ per m² per day', dimension: 'Energy flux' },
  'MJ m-2 d-1': { name: 'MJ per m² per day', dimension: 'Energy flux' },
  'MJ/m2': { name: 'MJ per square metre', dimension: 'Energy flux' },
  'day/m^(1/3)': { name: 'Manning roughness', dimension: 'Roughness' },
  'm-1/3 s': { name: 'Manning roughness', dimension: 'Roughness' },
  day: { name: 'days', dimension: 'Time' },
  h: { name: 'hours', dimension: 'Time' },
  year: { name: 'years', dimension: 'Time' },
  seconds: { name: 'seconds', dimension: 'Time' },
  date: { name: 'calendar date', dimension: 'Date' },
  YYYY: { name: 'year (YYYY)', dimension: 'Date' },
  code: { name: 'category code', dimension: 'Code' },
};

/** Friendly name for a unit symbol; the raw symbol if unknown. */
export function unitName(symbol: string): string {
  return UNIT_DICTIONARY[symbol]?.name ?? symbol;
}

/** Physical dimension for a unit symbol; `Other` if unknown. */
export function unitDimension(symbol: string): UnitDimension {
  return UNIT_DICTIONARY[symbol]?.dimension ?? 'Other';
}

/** Render a unit symbol with proper superscripts (e.g. `m s-1` → `m s⁻¹`). */
export function prettyUnit(symbol: string): string {
  return symbol
    .replace(/(\S)-1\b/g, '$1⁻¹')
    .replace(/(\S)-2\b/g, '$1⁻²')
    .replace(/(\S)-3\b/g, '$1⁻³')
    .replace(/\bm3\b/g, 'm³')
    .replace(/\bm2\b/g, 'm²')
    .replace(/\bcm3\b/g, 'cm³');
}
