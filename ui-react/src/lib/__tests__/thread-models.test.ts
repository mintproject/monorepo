import { describe, expect, it } from 'vitest';
import { diffThreadModels } from '../thread-models';

const row = (id: string, configId: string | null) => ({
  id,
  modelcatalog_configuration_id: configId,
});

describe('diffThreadModels', () => {
  it('reports no change when the selection matches what is stored', () => {
    const changes = diffThreadModels(
      't1',
      [row('tm-a', 'cfgA'), row('tm-b', 'cfgB')],
      ['cfgB', 'cfgA'],
    );
    expect(changes).toEqual({ removedIds: [], added: [], unchanged: true });
  });

  it('keeps a still-selected row instead of deleting and re-inserting it', () => {
    const changes = diffThreadModels('t1', [row('tm-a', 'cfgA')], ['cfgA', 'cfgB']);
    expect(changes.removedIds).toEqual([]);
    expect(changes.added).toEqual([{ thread_id: 't1', modelcatalog_configuration_id: 'cfgB' }]);
    expect(changes.unchanged).toBe(false);
  });

  it('removes only the rows whose configuration was deselected', () => {
    const changes = diffThreadModels('t1', [row('tm-a', 'cfgA'), row('tm-b', 'cfgB')], ['cfgA']);
    expect(changes.removedIds).toEqual(['tm-b']);
    expect(changes.added).toEqual([]);
  });

  it('leaves a row with no configuration id alone', () => {
    // 21 of TACC's 109 thread_model rows are in this state. The step cannot
    // show them, and deleting one would hit the same ON DELETE RESTRICT wall
    // this diff exists to avoid.
    const changes = diffThreadModels('t1', [row('tm-legacy', null)], ['cfgA']);
    expect(changes.removedIds).toEqual([]);
    expect(changes.added).toEqual([{ thread_id: 't1', modelcatalog_configuration_id: 'cfgA' }]);
  });

  it('reports no change for a thread that holds only unselectable legacy rows', () => {
    expect(diffThreadModels('t1', [row('tm-legacy', null)], []).unchanged).toBe(true);
  });

  it('inserts every selection for a thread that holds no rows yet', () => {
    const changes = diffThreadModels('t1', [], ['cfgA', 'cfgB']);
    expect(changes.added).toEqual([
      { thread_id: 't1', modelcatalog_configuration_id: 'cfgA' },
      { thread_id: 't1', modelcatalog_configuration_id: 'cfgB' },
    ]);
    expect(changes.removedIds).toEqual([]);
  });

  it('does not re-insert a configuration that is stored twice', () => {
    const changes = diffThreadModels('t1', [row('tm-a', 'cfgA'), row('tm-a2', 'cfgA')], ['cfgA']);
    expect(changes.added).toEqual([]);
    expect(changes.removedIds).toEqual([]);
  });
});
