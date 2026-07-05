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
          id: 'vp1',
          unit: { __typename: 'modelcatalog_unit', id: 'u1', label: 'Celsius' },
        },
        {
          __typename: 'modelcatalog_variable_presentation',
          id: 'vp2',
          unit: { __typename: 'modelcatalog_unit', id: 'u2', label: 'Fahrenheit' },
        },
        // Duplicate unit id — must be deduplicated client-side.
        {
          __typename: 'modelcatalog_variable_presentation',
          id: 'vp3',
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
          id: 'vp4',
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

// Fixture where one row matches a query on its name and another only on its
// description, so relevance ordering (name above description) is observable.
const rankingMockData: GetStandardVariablesWithUnitsQuery = {
  modelcatalog_standard_variable: [
    {
      __typename: 'modelcatalog_standard_variable',
      id: 'r1',
      label: 'runoff',
      description: 'Surface water routed downhill',
      same_as: null,
      variable_presentations: [
        {
          __typename: 'modelcatalog_variable_presentation',
          id: 'vp5',
          unit: { __typename: 'modelcatalog_unit', id: 'ru', label: 'mm/day' },
        },
      ],
    },
    {
      __typename: 'modelcatalog_standard_variable',
      id: 'r2',
      label: 'water_flow',
      description: 'Volumetric discharge',
      same_as: null,
      variable_presentations: [],
    },
  ],
};

const rankingMock = makeQueryMock(
  GetStandardVariablesWithUnitsDocument,
  {},
  { modelcatalog_standard_variable: rankingMockData.modelcatalog_standard_variable },
);

// Fixture spanning multiple categories plus one unnamed/UUID row (its label is
// a raw UUID, its description carries the real meaning).
const UNNAMED_UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const categoryMockData: GetStandardVariablesWithUnitsQuery = {
  modelcatalog_standard_variable: [
    {
      __typename: 'modelcatalog_standard_variable',
      id: 'c1',
      label: 'air_temperature',
      description: 'Near-surface air temperature',
      same_as: null,
      variable_presentations: [],
    },
    {
      __typename: 'modelcatalog_standard_variable',
      id: 'c2',
      label: 'soil_moisture_content',
      description: 'Volumetric water in soil',
      same_as: null,
      variable_presentations: [],
    },
    {
      __typename: 'modelcatalog_standard_variable',
      id: 'c3',
      label: UNNAMED_UUID,
      description: 'Downhill routed runoff depth',
      same_as: null,
      variable_presentations: [],
    },
  ],
};

const categoryMock = makeQueryMock(
  GetStandardVariablesWithUnitsDocument,
  {},
  { modelcatalog_standard_variable: categoryMockData.modelcatalog_standard_variable },
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

// While searching, the matched substring is wrapped in a <mark>, so a label like
// "wind_speed" is split across text nodes and a plain getByText fails. Match on
// the element whose full text content equals the label instead.
const wholeText = (full: string) => (_content: string, el: Element | null) =>
  el?.textContent === full;

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
      expect(screen.getByText(wholeText('wind_speed'))).toBeInTheDocument();
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

  // ─── Relevance-ranked search ─────────────────────────────────────────────────

  it('ranks a name match above a description-only match', async () => {
    const user = userEvent.setup();
    renderVariablesHome([rankingMock]);

    const input = await screen.findByPlaceholderText(/search standard variables/i);
    await user.type(input, 'water');

    await waitFor(() => {
      expect(screen.getByText(wholeText('water_flow'))).toBeInTheDocument();
    });
    // 'water_flow' matches on name -> ranks above 'runoff' (description only).
    const rowLabels = screen
      .getAllByRole('row')
      .map((r) => r.textContent ?? '')
      .filter((t) => t.includes('water_flow') || t.includes('runoff'));
    const flowIdx = rowLabels.findIndex((t) => t.includes('water_flow'));
    const runoffIdx = rowLabels.findIndex((t) => t.includes('runoff'));
    expect(flowIdx).toBeLessThan(runoffIdx);
  });

  it('surfaces a variable by its unit label and highlights the matching chip', async () => {
    const user = userEvent.setup();
    renderVariablesHome();

    const input = await screen.findByPlaceholderText(/search standard variables/i);
    // 'mm' appears only as precipitation's unit label, not in any name/description.
    await user.type(input, 'mm');

    await waitFor(() => {
      expect(screen.getByText('precipitation')).toBeInTheDocument();
      expect(screen.queryByText('temperature')).not.toBeInTheDocument();
      expect(screen.queryByText('wind_speed')).not.toBeInTheDocument();
    });

    // The matching unit chip is highlighted (rendered inside a <mark>).
    const mark = screen.getByText('mm');
    expect(mark.tagName).toBe('MARK');
  });

  // ─── Category column, filter, and unnamed-row demotion ───────────────────────

  it('renders a Category column with each row derived category', async () => {
    renderVariablesHome([categoryMock]);
    await waitFor(() => {
      expect(screen.getByText('Category')).toBeInTheDocument();
    });
    expect(screen.getByText('Atmosphere & Climate')).toBeInTheDocument();
    expect(screen.getByText('Soil')).toBeInTheDocument();
    expect(screen.getByText('Unnamed / Other')).toBeInTheDocument();
  });

  it('narrows the table to the selected category', async () => {
    const user = userEvent.setup();
    renderVariablesHome([categoryMock]);

    await screen.findByText('soil_moisture_content');

    const filter = screen.getByRole('combobox', { name: /filter by category/i });
    await user.click(filter);
    await user.click(await screen.findByRole('option', { name: 'Soil' }));

    await waitFor(() => {
      expect(screen.getByText('soil_moisture_content')).toBeInTheDocument();
      expect(screen.queryByText('air_temperature')).not.toBeInTheDocument();
      expect(screen.queryByText('Downhill routed runoff depth')).not.toBeInTheDocument();
    });
  });

  it('lists category options in canonical order with "Unnamed / Other" last', async () => {
    const user = userEvent.setup();
    renderVariablesHome([categoryMock]);

    await screen.findByText('soil_moisture_content');

    await user.click(screen.getByRole('combobox', { name: /filter by category/i }));

    const optionNames = screen
      .getAllByRole('option')
      .map((o) => o.textContent ?? '')
      .filter((t) => t !== 'All categories');
    expect(optionNames).toEqual(['Atmosphere & Climate', 'Soil', 'Unnamed / Other']);
  });

  it('renders an unnamed variable by its description and demotes it below named rows', async () => {
    renderVariablesHome([categoryMock]);

    await waitFor(() => {
      expect(screen.getByText('Downhill routed runoff depth')).toBeInTheDocument();
    });
    // The raw UUID is never rendered.
    expect(screen.queryByText(UNNAMED_UUID)).not.toBeInTheDocument();

    // The unnamed row sorts after the named rows in the default order.
    const rows = screen.getAllByRole('row').map((r) => r.textContent ?? '');
    const airIdx = rows.findIndex((t) => t.includes('air_temperature'));
    const unnamedIdx = rows.findIndex((t) => t.includes('Downhill routed runoff depth'));
    expect(airIdx).toBeGreaterThanOrEqual(0);
    expect(airIdx).toBeLessThan(unnamedIdx);
  });

  it('finds an unnamed variable by searching its description', async () => {
    const user = userEvent.setup();
    renderVariablesHome([categoryMock]);

    const input = await screen.findByPlaceholderText(/search standard variables/i);
    await user.type(input, 'runoff');

    await waitFor(() => {
      // The unnamed row surfaces via its description (rendered as the label,
      // with the match highlighted); the named rows drop out.
      const mark = screen.getByText('runoff');
      expect(mark.tagName).toBe('MARK');
      expect(screen.queryByText('air_temperature')).not.toBeInTheDocument();
      expect(screen.queryByText('soil_moisture_content')).not.toBeInTheDocument();
    });
  });

  it('disables column sorting while searching and re-enables it when cleared', async () => {
    const user = userEvent.setup();
    renderVariablesHome();

    // Empty box: the Standard Variable column header is a sort button. Use the
    // exact accessible name so it does not also match the per-row copy buttons
    // ("Copy standard variable name").
    expect(await screen.findByRole('button', { name: 'Standard Variable' })).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/search standard variables/i);
    await user.type(input, 'temp');

    // While searching, the header is no longer a sortable button.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Standard Variable' })).not.toBeInTheDocument();
    });
    expect(screen.getByText('Standard Variable')).toBeInTheDocument();

    // Clearing the box restores sortable column headers.
    await user.clear(input);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Standard Variable' })).toBeInTheDocument();
    });
  });
});
