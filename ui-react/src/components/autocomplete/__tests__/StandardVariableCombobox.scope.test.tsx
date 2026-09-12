/**
 * Scope behaviour of StandardVariableCombobox (monorepo#103).
 *
 * The catalog holds 668 standard variables at TACC; 147 are produced by a model
 * the Models step lists and 161 are taken as an input or adjusted by a
 * parameter. Offering all 668 lets a user pick a legitimate variable and meet
 * "No models found." one step later.
 */
import { MockedProvider } from '@apollo/client/testing';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { StandardVariableCombobox } from '@/components/autocomplete/StandardVariableCombobox';
import {
  GetDriverVariableOptionsDocument,
  GetIndicatorVariableOptionsDocument,
  PrefetchReferenceDataDocument,
} from '@/graphql/generated/graphql';

const sv = (id: string, label: string, description: string | null = null) => ({
  __typename: 'modelcatalog_standard_variable',
  id,
  label,
  description,
});

/** The whole catalog: one producible, one input-only, one that reaches nothing. */
const prefetchMock = {
  request: { query: PrefetchReferenceDataDocument },
  result: {
    data: {
      modelcatalog_standard_variable: [
        sv('sv-draw', 'drawdown'),
        sv('sv-poro', 'soil__porosity'),
        sv('sv-dead', '100hr_dead_moisture'),
      ],
      modelcatalog_unit: [],
    },
  },
};

const presentationRow = (presId: string, svId: string, label: string) => ({
  __typename: 'modelcatalog_dataset_specification_presentation',
  dataset_specification_id: `ds-${presId}`,
  presentation_id: presId,
  presentation: {
    __typename: 'modelcatalog_variable_presentation',
    id: presId,
    standard_variable: sv(svId, label),
  },
});

const indicatorMock = {
  request: { query: GetIndicatorVariableOptionsDocument },
  result: {
    data: {
      modelcatalog_dataset_specification_presentation: [
        presentationRow('p-draw', 'sv-draw', 'drawdown'),
      ],
    },
  },
};

const driverMock = {
  request: { query: GetDriverVariableOptionsDocument },
  result: {
    data: {
      inputs: [presentationRow('p-poro', 'sv-poro', 'soil__porosity')],
      adjusted: [
        {
          __typename: 'modelcatalog_parameter_adjusts_variable',
          parameter_id: 'param-1',
          variable_id: 'p-draw',
          variable: {
            __typename: 'modelcatalog_variable_presentation',
            id: 'p-draw',
            standard_variable: sv('sv-draw', 'drawdown'),
          },
        },
      ],
    },
  },
};

const mocks = [prefetchMock, indicatorMock, driverMock];

function renderCombobox(props: Partial<React.ComponentProps<typeof StandardVariableCombobox>>) {
  return render(
    <MockedProvider mocks={mocks}>
      <StandardVariableCombobox value={null} onChange={vi.fn()} {...props} />
    </MockedProvider>,
  );
}

async function openList() {
  const user = userEvent.setup();
  await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled());
  await user.click(screen.getByRole('combobox'));
  return user;
}

describe('StandardVariableCombobox scope', () => {
  it('offers the whole catalog by default, so registration forms are unchanged', async () => {
    renderCombobox({});
    await openList();
    await waitFor(() => expect(screen.getByText('drawdown')).toBeInTheDocument());
    expect(screen.getByText('100hr_dead_moisture')).toBeInTheDocument();
    expect(screen.getByText('soil__porosity')).toBeInTheDocument();
  });

  it('offers only producible variables under scope="indicator"', async () => {
    renderCombobox({ scope: 'indicator' });
    await openList();
    await waitFor(() => expect(screen.getByText('drawdown')).toBeInTheDocument());
    // Reaches no model, so it must not be offered.
    expect(screen.queryByText('100hr_dead_moisture')).not.toBeInTheDocument();
    // An input-only variable is not an indicator either.
    expect(screen.queryByText('soil__porosity')).not.toBeInTheDocument();
  });

  it('unions inputs and parameter-adjusted variables under scope="driver"', async () => {
    renderCombobox({ scope: 'driver' });
    await openList();
    // soil__porosity arrives through inputs, drawdown through a parameter.
    await waitFor(() => expect(screen.getByText('soil__porosity')).toBeInTheDocument());
    expect(screen.getByText('drawdown')).toBeInTheDocument();
    expect(screen.queryByText('100hr_dead_moisture')).not.toBeInTheDocument();
  });

  it('widens to the whole catalog when the escape link is clicked', async () => {
    renderCombobox({ scope: 'indicator', scopeLabel: 'a model produces' });
    const user = await openList();
    await waitFor(() => expect(screen.getByText('drawdown')).toBeInTheDocument());
    expect(screen.queryByText('100hr_dead_moisture')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /show every standard variable/i }));

    await waitFor(() => expect(screen.getByText('100hr_dead_moisture')).toBeInTheDocument());
  });

  it('names the scope and its size in the escape link', async () => {
    renderCombobox({ scope: 'indicator', scopeLabel: 'a model produces' });
    await openList();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /showing the 1 a model produces/i }),
      ).toBeInTheDocument(),
    );
  });

  // At TACC one live thread stores an indicator no configuration produces. The
  // scope must not make that value disappear from the control.
  it('keeps a stored value visible even when the scope does not carry it', async () => {
    renderCombobox({
      scope: 'indicator',
      value: { id: 'sv-dead', label: '100hr_dead_moisture', description: null },
    });
    await openList();
    await waitFor(() => expect(screen.getByText('drawdown')).toBeInTheDocument());
    // The trigger also prints the stored label, so assert on the option row.
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toContain('100hr_dead_moisture');
  });
});
