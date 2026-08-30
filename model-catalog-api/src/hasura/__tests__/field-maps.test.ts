import { describe, it, expect } from 'vitest';
import { getFieldSelection, FIELD_SELECTIONS_BY_ID } from '../field-maps.js';

describe('getFieldSelection — mode parameter', () => {
  it("default mode (no second arg) returns the shallow selection", () => {
    const sel = getFieldSelection('modelcatalog_configuration');
    expect(sel).toContain('inputs');
    // Shallow: no presentations under inputs.input
    expect(sel).not.toMatch(/inputs\s*{[^}]*input\s*{[^}]*presentations/s);
  });

  it("mode='list' returns the shallow selection", () => {
    const sel = getFieldSelection('modelcatalog_configuration', 'list');
    expect(sel).not.toMatch(/inputs\s*{[^}]*input\s*{[^}]*presentations/s);
  });

  it("mode='byId' for modelcatalog_configuration returns the deep selection", () => {
    const sel = getFieldSelection('modelcatalog_configuration', 'byId');
    expect(sel).toMatch(/inputs\s*{[^}]*input\s*{[^}]*presentations/s);
    expect(sel).toMatch(/outputs\s*{[^}]*output\s*{[^}]*presentations/s);
    expect(sel).toContain('has_short_name');
    expect(sel).toContain('has_long_name');
  });

  it("mode='byId' falls back to shallow for tables without a deep entry", () => {
    // dataset_specification has no FIELD_SELECTIONS_BY_ID entry yet
    expect(FIELD_SELECTIONS_BY_ID['modelcatalog_dataset_specification']).toBeUndefined();
    const sel = getFieldSelection('modelcatalog_dataset_specification', 'byId');
    // Should equal the shallow map's entry (already deep at this layer)
    expect(sel).toContain('presentations');
    expect(sel).toContain('standard_variable');
  });

  it("unknown table returns 'id label' fallback for both modes", () => {
    expect(getFieldSelection('totally_made_up_table')).toBe('id label');
    expect(getFieldSelection('totally_made_up_table', 'byId')).toBe('id label');
  });
});
