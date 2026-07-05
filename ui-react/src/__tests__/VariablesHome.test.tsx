import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { VariablesHome } from '../pages/variables/VariablesHome';
import {
  GetStandardVariablesWithUnitsDocument,
  type GetStandardVariablesWithUnitsQuery,
} from '../graphql/generated/graphql';
import { makeQueryMock, makeNetworkErrorMock } from '../test/utils/apollo-mocks';
import { renderWithProviders } from '../test/utils/render';

// ─── Test fixtures ────────────────────────────────────────────────────────────

const mockData: GetStandardVariablesWithUnitsQuery = {
  modelcatalog_standard_variable: [
    {
      __typename: 'modelcatalog_standard_variable',
      id: 'sv1',
      label: 'temperature',
      description: 'Atmospheric temperature measurement',
      same_as: ['http://example.org/temperature'],
      variable_presentations: [
        {
          __typename: 'modelcatalog_variable_presentation',
          unit: { __typename: 'modelcatalog_unit', id: 'u1', label: 'Celsius' },
        },
        {
          __typename: 'modelcatalog_variable_presentation',
          unit: { __typename: 'modelcatalog_unit', id: 'u2', label: 'Fahrenheit' },
        },
        // Duplicate unit id — must be deduplicated client-side.
        {
          __typename: 'modelcatalog_variable_presentation',
          unit: { __typename: 'modelcatalog_unit', id: 'u1', label: 'Celsius' },
        },
      ],
    },
    {
      __typename: 'modelcatalog_standard_variable',
      id: 'sv2',
      label: 'precipitation',
      description: 'Rainfall and snowfall accumulation',
      same_as: null,
      variable_presentations: [
        {
          __typename: 'modelcatalog_variable_presentation',
          unit: { __typename: 'modelcatalog_unit', id: 'u3', label: 'mm' },
        },
      ],
    },
    {
      __typename: 'modelcatalog_standard_variable',
      id: 'sv3',
      label: 'wind_speed',
      description: 'Speed of wind',
      same_as: null,
      // No presentations -> "no units".
      variable_presentations: [],
    },
  ],
};

const successMock = makeQueryMock(
  GetStandardVariablesWithUnitsDocument,
  {},
  { modelcatalog_standard_variable: mockData.modelcatalog_standard_variable },
);

const emptyMock = makeQueryMock(
  GetStandardVariablesWithUnitsDocument,
  {},
  { modelcatalog_standard_variable: [] },
);

const networkErrorMock = makeNetworkErrorMock(
  GetStandardVariablesWithUnitsDocument,
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
    expect(screen.getByText(/loading standard variables/i)).toBeInTheDocument();
  });

  it('renders the page heading', async () => {
    renderVariablesHome();
    await waitFor(() => {
      expect(screen.getByText('Explore Variables')).toBeInTheDocument();
    });
  });

  it('renders one row per standard variable with its name and description', async () => {
    renderVariablesHome();
    await waitFor(() => {
      expect(screen.getByText('temperature')).toBeInTheDocument();
      expect(screen.getByText('Atmospheric temperature measurement')).toBeInTheDocument();
      expect(screen.getByText('precipitation')).toBeInTheDocument();
      expect(screen.getByText('wind_speed')).toBeInTheDocument();
    });
  });

  it('renders deduplicated unit chips gathered from presentations', async () => {
    renderVariablesHome();
    await waitFor(() => {
      // temperature has Celsius, Fahrenheit, Celsius (dup) -> Celsius appears once.
      expect(screen.getAllByText('Celsius')).toHaveLength(1);
      expect(screen.getByText('Fahrenheit')).toBeInTheDocument();
      expect(screen.getByText('mm')).toBeInTheDocument();
    });
  });

  it('shows a "no units" indication for a variable with no presentations', async () => {
    renderVariablesHome();
    await waitFor(() => {
      expect(screen.getByText(/no units/i)).toBeInTheDocument();
    });
  });

  it('renders the search input', async () => {
    renderVariablesHome();
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search standard variables/i)).toBeInTheDocument();
    });
  });

  it('filters rows by search query matching name', async () => {
    const user = userEvent.setup();
    renderVariablesHome();

    const input = await screen.findByPlaceholderText(/search standard variables/i);
    await user.type(input, 'wind');

    await waitFor(() => {
      expect(screen.getByText('wind_speed')).toBeInTheDocument();
      expect(screen.queryByText('temperature')).not.toBeInTheDocument();
      expect(screen.queryByText('precipitation')).not.toBeInTheDocument();
    });
  });

  it('filters rows by search query matching description', async () => {
    const user = userEvent.setup();
    renderVariablesHome();

    const input = await screen.findByPlaceholderText(/search standard variables/i);
    await user.type(input, 'Rainfall');

    await waitFor(() => {
      expect(screen.getByText('precipitation')).toBeInTheDocument();
      expect(screen.queryByText('temperature')).not.toBeInTheDocument();
    });
  });

  it('shows an empty-result message when search yields nothing', async () => {
    const user = userEvent.setup();
    renderVariablesHome();

    const input = await screen.findByPlaceholderText(/search standard variables/i);
    await user.type(input, 'zzz_no_match_zzz');

    await waitFor(() => {
      expect(screen.getByText(/no standard variables found/i)).toBeInTheDocument();
    });
  });

  it('shows an empty-result message when there are no standard variables', async () => {
    renderVariablesHome([emptyMock]);
    await waitFor(() => {
      expect(screen.getByText(/no standard variables found/i)).toBeInTheDocument();
    });
  });

  it('renders table column headers without a Variable Presentation column', async () => {
    renderVariablesHome();
    await waitFor(() => {
      expect(screen.getByText('Standard Variable')).toBeInTheDocument();
      expect(screen.getByText('Units')).toBeInTheDocument();
    });
    expect(screen.queryByText('Variable Presentation')).not.toBeInTheDocument();
  });

  it('does not render the "What is a Variable Presentation?" explanation card', async () => {
    renderVariablesHome();
    await screen.findByText('temperature');
    expect(screen.queryByText(/what is a variable presentation/i)).not.toBeInTheDocument();
  });

  it('copies the standard variable name when the copy button is clicked', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    renderVariablesHome();
    const buttons = await screen.findAllByRole('button', { name: /copy standard variable name/i });
    expect(buttons).toHaveLength(mockData.modelcatalog_standard_variable.length);

    await user.click(buttons[0]!);
    expect(writeText).toHaveBeenCalledWith('temperature');
  });

  it('shows error message on network failure', async () => {
    renderVariablesHome([networkErrorMock]);
    await waitFor(() => {
      expect(screen.getByText(/failed to load standard variables/i)).toBeInTheDocument();
    });
  });

  it('renders an accessible table with aria-label', async () => {
    renderVariablesHome();
    await waitFor(() => {
      expect(screen.getByRole('table', { name: /standard variables/i })).toBeInTheDocument();
    });
  });
});
