import { MockedProvider } from '@apollo/client/testing';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StandardVariableUnitPicker } from '@/components/autocomplete/StandardVariableUnitPicker';
import {
  GetVariablePresentationsDocument,
  PrefetchReferenceDataDocument,
} from '@/graphql/generated/graphql';

const sv = (id: string, label: string, description: string | null = null) => ({
  __typename: 'modelcatalog_standard_variable',
  id,
  label,
  description,
});
const unit = (id: string, label: string) => ({ __typename: 'modelcatalog_unit', id, label });

const prefetchMock = {
  request: { query: PrefetchReferenceDataDocument },
  result: {
    data: {
      modelcatalog_standard_variable: [
        sv('sv-air', 'air__temperature', 'near-surface air'),
        sv('sv-chan', 'channel_water__volume_flow_rate', 'discharge'),
      ],
      modelcatalog_unit: [unit('u-degc', 'degC'), unit('u-flow', 'm3 s-1')],
    },
  },
};

const presentation = (
  id: string,
  svId: string,
  label: string,
  u: { id: string; label: string },
) => ({
  __typename: 'modelcatalog_variable_presentation',
  id,
  label: `${id}-presentation`,
  has_long_name: null,
  has_short_name: null,
  standard_variable: sv(svId, label),
  unit: { __typename: 'modelcatalog_unit', ...u },
});

const presMock = {
  request: { query: GetVariablePresentationsDocument },
  result: {
    data: {
      modelcatalog_variable_presentation: [
        presentation('p1', 'sv-air', 'air__temperature', { id: 'u-degc', label: 'degC' }),
        presentation('p2', 'sv-chan', 'channel_water__volume_flow_rate', {
          id: 'u-flow',
          label: 'm3 s-1',
        }),
      ],
    },
  },
};

function renderPicker(
  props: Partial<React.ComponentProps<typeof StandardVariableUnitPicker>> = {},
) {
  const onResolve = props.onResolve ?? vi.fn();
  render(
    <MockedProvider mocks={[prefetchMock, presMock]}>
      <StandardVariableUnitPicker variable={null} unit={null} onResolve={onResolve} {...props} />
    </MockedProvider>,
  );
  return { onResolve };
}

afterEach(() => {
  localStorage.clear();
});

describe('StandardVariableUnitPicker', () => {
  it('resolves a variable and its suggested unit through the guided flow', async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn();
    renderPicker({ onResolve });

    const trigger = await screen.findByRole('combobox', {
      name: /choose standard variable and unit/i,
    });
    await waitFor(() => expect(trigger).toBeEnabled());
    await user.click(trigger);

    await user.click(await screen.findByRole('button', { name: /^Air/ }));
    await user.click(await screen.findByRole('button', { name: 'Temperature' }));

    expect(await screen.findByText('degrees Celsius')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /use variable \+ unit/i }));

    expect(onResolve).toHaveBeenCalledWith(expect.objectContaining({ label: 'air__temperature' }), {
      id: 'u-degc',
      label: 'degC',
    });
  });

  it('offers the create gate at a search dead-end', async () => {
    const user = userEvent.setup();
    const onRequestCreate = vi.fn();
    renderPicker({ onRequestCreate });

    const trigger = await screen.findByRole('combobox', {
      name: /choose standard variable and unit/i,
    });
    await waitFor(() => expect(trigger).toBeEnabled());
    await user.click(trigger);

    await user.type(screen.getByRole('textbox', { name: /search standard variables/i }), 'albedo');
    await user.click(
      await screen.findByRole('button', { name: /create .*albedo.* as a new standard variable/i }),
    );

    expect(onRequestCreate).toHaveBeenCalledWith({ query: 'albedo', phenomenon: null });
  });
});
