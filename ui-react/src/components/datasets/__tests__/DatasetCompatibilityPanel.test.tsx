import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useLocation } from 'react-router-dom';

import { DatasetCompatibilityPanel } from '../DatasetCompatibilityPanel';
import type { DatasetDiscoveryResult } from '@/lib/datasets/types';
import { renderWithProviders } from '@/test/utils/render';

const configurationId = 'https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_drought';

vi.mock('@/graphql/generated/modeling', () => ({
  extractModelIO: vi.fn(() => ({
    inputs: [
      {
        id: 'input-1',
        name: 'Groundwater head',
        variableIds: ['groundwater__hydraulic_head'],
        variableLabels: [],
        optional: false,
      },
    ],
    outputs: [],
    producesVariableIds: [],
  })),
  useGetModelTreeWithRegionsQuery: vi.fn(() => ({
    data: {
      modelcatalog_software: [
        {
          id: 'modflow',
          label: 'MODFLOW',
          versions: [
            {
              id: '2005',
              label: '2005',
              configurations: [
                {
                  id: configurationId,
                  label: 'Barton Springs drought setup',
                  regions: [],
                  inputs: [],
                  outputs: [],
                  child_configurations: [],
                },
              ],
            },
          ],
        },
      ],
    },
    loading: false,
    error: undefined,
  })),
}));

const dataset: DatasetDiscoveryResult = {
  id: 'dataset-1',
  name: 'Barton Springs dataset',
  region: 'Texas',
  variables: ['groundwater__hydraulic_head'],
  datatype: 'NetCDF',
  time_period: null,
  description: 'A test dataset.',
  version: '1',
  limitations: '',
  source: { name: 'Test source', url: '', type: 'test' },
  resources: [],
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

describe('DatasetCompatibilityPanel', () => {
  it('uses the configuration slug when opening a model', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <>
        <DatasetCompatibilityPanel dataset={dataset} open onClose={vi.fn()} />
        <LocationProbe />
      </>,
    );

    await user.click(screen.getByRole('button', { name: 'View model' }));

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/modelconfigurations/modflow_2005_BartonSprings_drought',
    );
  });
});
