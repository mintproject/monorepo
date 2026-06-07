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
});
