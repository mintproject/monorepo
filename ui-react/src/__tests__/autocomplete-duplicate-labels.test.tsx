/**
 * Regression: real catalog standard variables frequently share a label (and/or
 * have null descriptions), so a cmdk item value derived from label+description
 * collides across items, breaking click-to-select. The combobox must key items
 * by their unique id so each option is independently selectable.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { StandardVariableCombobox } from '@/components/autocomplete/StandardVariableCombobox';
import { PrefetchReferenceDataDocument } from '@/graphql/generated/graphql';
import { renderWithProviders } from '../test/utils/render';

const dupVars = [
  {
    __typename: 'modelcatalog_standard_variable' as const,
    id: 'https://w3id.org/okn/i/mint/sv-a',
    label: 'Precipitation',
    description: null,
  },
  {
    __typename: 'modelcatalog_standard_variable' as const,
    id: 'https://w3id.org/okn/i/mint/sv-b',
    label: 'Precipitation',
    description: null,
  },
];

const prefetchMock = {
  request: { query: PrefetchReferenceDataDocument, variables: {} },
  result: {
    data: {
      __typename: 'query_root',
      modelcatalog_standard_variable: dupVars,
      modelcatalog_unit: [],
    },
  },
};

describe('StandardVariableCombobox with duplicate labels', () => {
  it('selects the specific option clicked even when two options share a label', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<StandardVariableCombobox value={null} onChange={onChange} />, {
      apolloMocks: [prefetchMock],
    });

    await waitFor(() => expect(screen.getByRole('combobox')).not.toBeDisabled());
    await user.click(screen.getByRole('combobox'));

    await waitFor(() => expect(screen.getAllByText('Precipitation')).toHaveLength(2));
    const items = screen.getAllByText('Precipitation');
    await user.click(items[1]!); // the second option

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      id: 'https://w3id.org/okn/i/mint/sv-b',
      label: 'Precipitation',
      description: null,
    });
  });
});
