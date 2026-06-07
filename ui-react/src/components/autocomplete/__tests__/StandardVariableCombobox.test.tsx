import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  StandardVariableCombobox,
  type StandardVariableOption,
} from '@/components/autocomplete/StandardVariableCombobox';
import { PrefetchReferenceDataDocument } from '@/graphql/generated/graphql';
import { makeQueryMock } from '@/test/utils/apollo-mocks';
import { renderWithProviders, screen, waitFor } from '@/test/utils/render';

const prefetchMock = makeQueryMock(
  PrefetchReferenceDataDocument,
  {},
  {
    modelcatalog_standard_variable: [
      { id: 'sv-soil', label: 'soil_moisture_content', description: 'Volumetric soil moisture' },
      { id: 'sv-air', label: 'air__temperature', description: 'Near-surface air temperature' },
      {
        id: 'sv-uuid',
        label: '06100430-298a-49d7-9834-590783d62379',
        description: 'Near-surface moisture index',
      },
    ],
    modelcatalog_unit: [],
  },
);

afterEach(() => {
  localStorage.clear();
});

function renderCombobox(value: StandardVariableOption | null = null) {
  const onChange = vi.fn();
  renderWithProviders(<StandardVariableCombobox value={value} onChange={onChange} />, {
    apolloMocks: [prefetchMock],
  });
  return { onChange };
}

describe('StandardVariableCombobox', () => {
  it('shows the selected label on the trigger', async () => {
    renderCombobox({ id: 'sv-soil', label: 'soil_moisture_content', description: null });
    expect(await screen.findByText('soil_moisture_content')).toBeInTheDocument();
  });

  it('shows the description, not the raw UUID, on the trigger for an unnamed selection', async () => {
    renderCombobox({
      id: 'sv-uuid',
      label: '06100430-298a-49d7-9834-590783d62379',
      description: 'Near-surface moisture index',
    });
    expect(await screen.findByText('Near-surface moisture index')).toBeInTheDocument();
    expect(screen.queryByText('06100430-298a-49d7-9834-590783d62379')).not.toBeInTheDocument();
  });

  it('opens and renders category group headings', async () => {
    const user = userEvent.setup();
    renderCombobox();
    await waitFor(() => expect(screen.getByRole('combobox')).not.toBeDisabled());
    await user.click(screen.getByRole('combobox'));
    expect(await screen.findByText('Soil')).toBeInTheDocument();
    expect(screen.getByText('Atmosphere & Climate')).toBeInTheDocument();
    expect(screen.getByText('Unnamed / Other')).toBeInTheDocument();
  });

  it('demotes a UUID row by showing its description as the name', async () => {
    const user = userEvent.setup();
    renderCombobox();
    await waitFor(() => expect(screen.getByRole('combobox')).not.toBeDisabled());
    await user.click(screen.getByRole('combobox'));
    expect(await screen.findByText('Near-surface moisture index')).toBeInTheDocument();
  });

  it('records the selection and reports it via onChange', async () => {
    const user = userEvent.setup();
    const { onChange } = renderCombobox();
    await waitFor(() => expect(screen.getByRole('combobox')).not.toBeDisabled());
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('soil_moisture_content'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sv-soil', label: 'soil_moisture_content' }),
    );
  });

  it('deselects when the already-selected item is clicked again', async () => {
    const user = userEvent.setup();
    const { onChange } = renderCombobox({
      id: 'sv-air',
      label: 'air__temperature',
      description: null,
    });
    await waitFor(() => expect(screen.getByRole('combobox')).not.toBeDisabled());
    await user.click(screen.getByRole('combobox'));
    const matches = await screen.findAllByText('air__temperature');
    await user.click(matches[matches.length - 1]!);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('pins a just-selected variable under "Recently used" on reopen', async () => {
    const user = userEvent.setup();
    renderCombobox();
    await waitFor(() => expect(screen.getByRole('combobox')).not.toBeDisabled());
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('air__temperature'));
    await user.click(screen.getByRole('combobox')); // reopen
    expect(await screen.findByText('Recently used')).toBeInTheDocument();
  });

  it('invokes onRequestNew from the footer action when provided', async () => {
    const user = userEvent.setup();
    const onRequestNew = vi.fn();
    renderWithProviders(
      <StandardVariableCombobox value={null} onChange={vi.fn()} onRequestNew={onRequestNew} />,
      { apolloMocks: [prefetchMock] },
    );
    await waitFor(() => expect(screen.getByRole('combobox')).not.toBeDisabled());
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('+ Request a new standard variable'));
    expect(onRequestNew).toHaveBeenCalled();
  });
});
