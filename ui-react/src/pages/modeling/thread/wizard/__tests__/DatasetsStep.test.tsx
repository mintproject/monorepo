import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils/render';
import type { Thread } from '@/graphql/generated/modeling';
import type { ThreadModel } from '../../MintDatasets';
import { DatasetsStep, dateCoverage } from '../DatasetsStep';

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
  },
};

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

describe('DatasetsStep', () => {
  it('renders one card per selected model with an inputs counter', async () => {
    renderWithProviders(
      <DatasetsStep
        thread={makeThread()}
        models={models}
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
        onUpdated={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText(/select model\(s\) first/i)).toBeInTheDocument();
  });
});
