import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from '@/test/utils/render';
import type { Thread } from '@/graphql/generated/modeling';
import type { ModelEnsembleMap, ThreadModel } from '@/graphql/generated/execution';
import type { DataCatalogDataset } from '@/lib/data-catalog';
import {
  DatasetsStep,
  assignmentsFromBindings,
  datasetOptionLabel,
  dateCoverage,
  splitByRegion,
} from '../DatasetsStep';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'success', datasets: [] }),
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    __typename: 'thread',
    id: 't1',
    name: 'Flood extent',
    task_id: 'task1',
    start_date: '2000-01-01',
    end_date: '2026-01-01',
    region_id: 'texas',
    driving_variable_id: null,
    response_variable_id: null,
    events: [],
    permissions: [
      { __typename: 'thread_permission', user_id: 'testuser', read: true, write: true },
    ],
    thread_models: [],
    ...overrides,
  };
}

const models: Record<string, ThreadModel> = {
  cfgA: {
    id: 'cfgA',
    name: 'PIHM Flood A',
    input_files: [
      { id: 'inA', name: 'precipitation', variables: ['sv-precip'], isOptional: false },
    ],
    output_files: [],
    input_parameters: [],
  },
};

const ensembles: ModelEnsembleMap = { cfgA: { id: 'tm-1', bindings: {} } };

describe('dateCoverage', () => {
  const req = { start: new Date('2000-01-01'), end: new Date('2026-01-01') };
  it('returns "none" when no requested range is set', () => {
    expect(dateCoverage(null, { start: new Date('2010-01-01'), end: new Date('2012-01-01') })).toBe(
      'none',
    );
  });
  it('returns "full" when the dataset spans the whole window', () => {
    expect(dateCoverage(req, { start: new Date('1999-01-01'), end: new Date('2027-01-01') })).toBe(
      'full',
    );
  });
  it('returns "partial" when the dataset covers only part of the window', () => {
    expect(dateCoverage(req, { start: new Date('2010-01-01'), end: new Date('2012-01-01') })).toBe(
      'partial',
    );
  });
});

describe('assignmentsFromBindings', () => {
  it('reads the dataset behind each bound dataslice', () => {
    const out = assignmentsFromBindings(
      { cfgA: { id: 'tm-1', bindings: { inA: ['slice-1'] } } },
      {
        'slice-1': {
          id: 'slice-1',
          name: 'Rainfall for thread',
          dataset: { id: 'ckan-precip', name: 'Rainfall' },
          selected_resources: 2,
          resources: [{ id: 'r1', name: 'a.tif', url: 'http://x/a.tif', selected: true }],
        },
      },
    );
    expect(out['cfgA']?.['inA']).toMatchObject({
      datasetId: 'ckan-precip',
      datasetName: 'Rainfall',
    });
    expect(out['cfgA']?.['inA']?.resources).toHaveLength(1);
  });

  it('ignores a parameter binding, which has no dataslice behind it', () => {
    const out = assignmentsFromBindings(
      { cfgA: { id: 'tm-1', bindings: { 'param-x': ['0.5'] } } },
      {},
    );
    expect(out['cfgA']).toBeUndefined();
  });
});

// ─── Region handling (issue #97) ──────────────────────────────────────────────

function dataset(
  id: string,
  region_match: DataCatalogDataset['region_match'],
  time_period: DataCatalogDataset['time_period'] = null,
): DataCatalogDataset {
  return {
    id,
    name: id,
    region: '',
    region_match,
    variables: [],
    datatype: 'csv',
    time_period,
    description: '',
    version: '',
    limitations: '',
    source: { name: '', url: '', type: '' },
    resources: [],
  };
}

describe('splitByRegion', () => {
  it('keeps "no location" apart from "elsewhere": they are different claims', () => {
    const { inRegion, noLocation, outside } = splitByRegion([
      dataset('here', 'inside'),
      dataset('nowhere', 'unknown'),
      dataset('elsewhere', 'outside'),
    ]);
    expect(inRegion.map((d) => d.id)).toEqual(['here']);
    expect(noLocation.map((d) => d.id)).toEqual(['nowhere']);
    expect(outside.map((d) => d.id)).toEqual(['elsewhere']);
  });
});

describe('datasetOptionLabel', () => {
  const requested = { start: new Date('2000-01-01'), end: new Date('2026-01-01') };

  it('badges a dataset that declares no location', () => {
    expect(datasetOptionLabel(dataset('x', 'unknown'), null)).toContain('! no location');
  });

  it('badges a dataset that declares no dates, as the date rule already implied', () => {
    expect(datasetOptionLabel(dataset('x', 'inside'), requested)).toContain('! no dates');
  });

  it('says nothing about location for a dataset inside the region', () => {
    const label = datasetOptionLabel(
      dataset('x', 'inside', {
        start_date: new Date('1999-01-01'),
        end_date: new Date('2027-01-01'),
      }),
      requested,
    );
    expect(label).not.toContain('no location');
    expect(label).toContain('dates full');
  });
});

describe('DatasetsStep region filter', () => {
  /** Two annotated packages: one in the box, one far outside, one with no `spatial`. */
  const TEXAS_POLYGON = {
    type: 'Polygon',
    coordinates: [
      [
        [-106, 26],
        [-94, 26],
        [-94, 36],
        [-106, 36],
        [-106, 26],
      ],
    ],
  };

  function ckanPackage(name: string, spatial?: unknown) {
    return {
      id: `uuid-${name}`,
      name,
      title: name,
      ...(spatial ? { spatial: JSON.stringify(spatial) } : {}),
      resources: [{ id: `r-${name}`, format: 'csv', mint_standard_variables: 'sv-precip' }],
    };
  }

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          result: {
            count: 3,
            results: [
              ckanPackage('austin-rain', TEXAS_POLYGON),
              ckanPackage('bethel-elevation', { type: 'Point', coordinates: [-161.7, 60.79] }),
              ckanPackage('gam-model-files'),
            ],
          },
        }),
      }),
    );
  });

  function renderStep() {
    return renderWithProviders(
      <DatasetsStep
        thread={makeThread()}
        models={models}
        ensembles={ensembles}
        persistedData={{}}
        regionGeometry={[TEXAS_POLYGON]}
        onUpdated={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
    );
  }

  it('offers the in-region dataset and the one with no location, and badges the latter', async () => {
    renderStep();
    const picker = await screen.findByLabelText('Choose dataset');
    expect(picker).toHaveTextContent('austin-rain');
    expect(picker).toHaveTextContent('gam-model-files · ! no location');
    // 11 of TACC's 33 annotated packages have no extent; ext_bbox hid all of them.
    expect(picker).toHaveTextContent('Choose · 2 options');
  });

  it('hides the dataset that is positively elsewhere, behind a counted link', async () => {
    renderStep();
    const picker = await screen.findByLabelText('Choose dataset');
    expect(picker).not.toHaveTextContent('bethel-elevation');
    expect(
      screen.getByRole('button', { name: /Show 1 dataset outside this region/ }),
    ).toBeInTheDocument();
  });

  it('reveals the outside dataset when the link is used', async () => {
    renderStep();
    await screen.findByLabelText('Choose dataset');
    await userEvent.click(screen.getByRole('button', { name: /Show 1 dataset/ }));
    expect(screen.getByLabelText('Choose dataset')).toHaveTextContent('bethel-elevation');
  });

  it('applies no region filter when the thread region carries no geometry', async () => {
    renderWithProviders(
      <DatasetsStep
        thread={makeThread()}
        models={models}
        ensembles={ensembles}
        persistedData={{}}
        regionGeometry={[]}
        onUpdated={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    const picker = await screen.findByLabelText('Choose dataset');
    expect(picker).toHaveTextContent('Choose · 3 options');
    expect(screen.getByTestId('filtered-by-banner')).toHaveTextContent(/no extent, not applied/);
  });
});

describe('DatasetsStep', () => {
  it('counts a binding already written to the database', async () => {
    renderWithProviders(
      <DatasetsStep
        thread={makeThread()}
        models={models}
        ensembles={{ cfgA: { id: 'tm-1', bindings: { inA: ['slice-1'] } } }}
        persistedData={{
          'slice-1': {
            id: 'slice-1',
            name: 'Rainfall for thread',
            dataset: { id: 'ckan-precip', name: 'Rainfall' },
            selected_resources: 1,
            resources: [],
          },
        }}
        onUpdated={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(await screen.findByText(/1 \/ 1 inputs/i)).toBeInTheDocument();
  });

  it('renders one card per selected model with an inputs counter', async () => {
    renderWithProviders(
      <DatasetsStep
        thread={makeThread()}
        models={models}
        ensembles={ensembles}
        persistedData={{}}
        onUpdated={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(await screen.findByText('PIHM Flood A')).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 1 inputs/i)).toBeInTheDocument();
  });

  it('disables Continue until every input is assigned', async () => {
    renderWithProviders(
      <DatasetsStep
        thread={makeThread()}
        models={models}
        ensembles={ensembles}
        persistedData={{}}
        onUpdated={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    await screen.findByText('PIHM Flood A');
    expect(screen.getByTestId('step-continue')).toBeDisabled();
  });

  it('renders a region + dates banner reflecting Framing', async () => {
    renderWithProviders(
      <DatasetsStep
        thread={makeThread()}
        models={models}
        ensembles={ensembles}
        persistedData={{}}
        onUpdated={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    const banner = await screen.findByTestId('filtered-by-banner');
    expect(banner).toHaveTextContent(/region/i);
    expect(banner).toHaveTextContent(/dates/i);
  });

  it('shows a guidance message when no models are selected', () => {
    renderWithProviders(
      <DatasetsStep
        thread={makeThread()}
        models={{}}
        ensembles={{}}
        persistedData={{}}
        onUpdated={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText(/select model\(s\) first/i)).toBeInTheDocument();
  });
});
