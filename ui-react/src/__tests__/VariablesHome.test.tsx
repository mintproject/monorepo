import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { VariablesHome } from '../pages/variables/VariablesHome';
import {
  GetVariablePresentationsDocument,
  type GetVariablePresentationsQuery,
} from '../graphql/generated/graphql';
import { makeQueryMock, makeNetworkErrorMock } from '../test/utils/apollo-mocks';
import { renderWithProviders } from '../test/utils/render';

// ─── Test fixtures ────────────────────────────────────────────────────────────

const mockData: GetVariablePresentationsQuery = {
  modelcatalog_variable_presentation: [
    {
      __typename: 'modelcatalog_variable_presentation',
      id: 'vp1',
      label: 'Temperature (Celsius)',
      has_long_name: 'Temperature in Celsius',
      has_short_name: 'temp_c',
      standard_variable: {
        __typename: 'modelcatalog_standard_variable',
        id: 'sv1',
        label: 'temperature',
        description: 'Atmospheric temperature measurement',
      },
      unit: {
        __typename: 'modelcatalog_unit',
        id: 'u1',
        label: 'Celsius',
      },
    },
    {
      __typename: 'modelcatalog_variable_presentation',
      id: 'vp2',
      label: 'Precipitation (mm)',
      has_long_name: 'Daily precipitation in millimetres',
      has_short_name: 'precip',
      standard_variable: {
        __typename: 'modelcatalog_standard_variable',
        id: 'sv2',
        label: 'precipitation',
        description: 'Rainfall and snowfall accumulation',
      },
      unit: {
        __typename: 'modelcatalog_unit',
        id: 'u2',
        label: 'mm',
      },
    },
    {
      __typename: 'modelcatalog_variable_presentation',
      id: 'vp3',
      label: 'Wind Speed',
      has_long_name: null,
      has_short_name: null,
      standard_variable: null,
      unit: null,
    },
  ],
};

const successMock = makeQueryMock(
  GetVariablePresentationsDocument,
  {},
  { modelcatalog_variable_presentation: mockData.modelcatalog_variable_presentation },
);

const networkErrorMock = makeNetworkErrorMock(
  GetVariablePresentationsDocument,
  {},
  'Network request failed',
);

function renderVariablesHome(mocks = [successMock]) {
  return renderWithProviders(<VariablesHome />, { apolloMocks: mocks });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('VariablesHome', () => {
  it('renders loading state initially', () => {
    renderVariablesHome();
    expect(screen.getByText(/loading variable presentations/i)).toBeInTheDocument();
  });

  it('renders the page heading', async () => {
    renderVariablesHome();
    await waitFor(() => {
      expect(screen.getByText('Explore Variables')).toBeInTheDocument();
    });
  });

  it('renders variable presentation rows after data loads', async () => {
    renderVariablesHome();
    await waitFor(() => {
      expect(screen.getByText('Temperature (Celsius)')).toBeInTheDocument();
      expect(screen.getByText('Precipitation (mm)')).toBeInTheDocument();
      expect(screen.getByText('Wind Speed')).toBeInTheDocument();
    });
  });

  it('renders standard variable labels', async () => {
    renderVariablesHome();
    await waitFor(() => {
      expect(screen.getByText('temperature')).toBeInTheDocument();
      expect(screen.getByText('precipitation')).toBeInTheDocument();
    });
  });

  it('renders unit labels', async () => {
    renderVariablesHome();
    await waitFor(() => {
      expect(screen.getByText('Celsius')).toBeInTheDocument();
      expect(screen.getByText('mm')).toBeInTheDocument();
    });
  });

  it('shows dash for missing standard variable and unit', async () => {
    renderVariablesHome();
    await waitFor(() => {
      // Wind Speed row has null standard_variable and null unit — both render as '-'
      const dashes = screen.getAllByText('-');
      expect(dashes.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('renders the search input', async () => {
    renderVariablesHome();
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search variable presentations...')).toBeInTheDocument();
    });
  });

  it('filters rows by search query matching label', async () => {
    const user = userEvent.setup();
    renderVariablesHome();

    const input = await screen.findByPlaceholderText('Search variable presentations...');
    await user.type(input, 'Wind');

    await waitFor(() => {
      expect(screen.getByText('Wind Speed')).toBeInTheDocument();
      expect(screen.queryByText('Temperature (Celsius)')).not.toBeInTheDocument();
      expect(screen.queryByText('Precipitation (mm)')).not.toBeInTheDocument();
    });
  });

  it('filters rows by search query matching standard variable label', async () => {
    const user = userEvent.setup();
    renderVariablesHome();

    const input = await screen.findByPlaceholderText('Search variable presentations...');
    await user.type(input, 'precipitation');

    await waitFor(() => {
      expect(screen.getByText('Precipitation (mm)')).toBeInTheDocument();
      expect(screen.queryByText('Temperature (Celsius)')).not.toBeInTheDocument();
    });
  });

  it('shows "no results" message when search yields nothing', async () => {
    const user = userEvent.setup();
    renderVariablesHome();

    const input = await screen.findByPlaceholderText('Search variable presentations...');
    await user.type(input, 'zzz_no_match_zzz');

    await waitFor(() => {
      expect(screen.getByText(/no variable presentations found/i)).toBeInTheDocument();
    });
  });

  it('renders table column headers', async () => {
    renderVariablesHome();
    await waitFor(() => {
      expect(screen.getByText('Standard Variables')).toBeInTheDocument();
      expect(screen.getByText('Variable Presentation')).toBeInTheDocument();
      expect(screen.getByText('Units')).toBeInTheDocument();
    });
  });

  it('renders copy buttons for each row', async () => {
    renderVariablesHome();
    const buttons = await screen.findAllByRole('button', { name: /copy standard variable name/i });
    expect(buttons).toHaveLength(mockData.modelcatalog_variable_presentation.length);
  });

  it('shows the collapsible explanation section expanded by default', async () => {
    renderVariablesHome();
    await waitFor(() => {
      expect(screen.getByText('What is a Standard Variable?')).toBeInTheDocument();
      expect(screen.getByText('What is a Variable Presentation?')).toBeInTheDocument();
    });
  });

  it('collapses the explanation section when toggle is clicked', async () => {
    const user = userEvent.setup();
    renderVariablesHome();

    // Wait for data so the toggle is visible
    await screen.findByText('What is a Standard Variable?');

    const toggle = screen.getByRole('button', { name: /hide explanation/i });
    await user.click(toggle);

    await waitFor(() => {
      expect(screen.queryByText('What is a Standard Variable?')).not.toBeInTheDocument();
    });
  });

  it('shows error message on network failure', async () => {
    renderVariablesHome([networkErrorMock]);
    await waitFor(() => {
      expect(screen.getByText(/failed to load variable presentations/i)).toBeInTheDocument();
    });
  });

  it('renders an accessible table with aria-label', async () => {
    renderVariablesHome();
    await waitFor(() => {
      expect(screen.getByRole('table', { name: /variable presentations/i })).toBeInTheDocument();
    });
  });
});
