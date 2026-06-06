/**
 * Tests for InputOutputSection and InputRow components.
 *
 * These are integration-level tests using a minimal form wrapper
 * to exercise useFieldArray and useFormContext.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { renderWithProviders } from '@/test/utils/render';
import { configurationFormSchema, type ConfigurationFormSchema } from '@/schemas/configuration';
import { InputOutputSection } from '../InputOutputSection';
import { PrefetchReferenceDataDocument } from '@/graphql/generated/graphql';

// ─── Mock data ────────────────────────────────────────────────────────────────

const emptyRefDataMock = {
  request: { query: PrefetchReferenceDataDocument },
  result: {
    data: {
      modelcatalog_standard_variable: [],
      modelcatalog_unit: [],
    },
  },
};

// ─── Test wrapper ────────────────────────────────────────────────────────────

function InputsFormWrapper({ prefix }: { prefix: 'inputs' | 'outputs' }) {
  const methods = useForm<ConfigurationFormSchema>({
    resolver: zodResolver(configurationFormSchema),
    defaultValues: {
      label: 'Test',
      inputs: [],
      outputs: [],
      parameters: [],
      authors: [],
      regions: [],
    },
  });

  return (
    <FormProvider {...methods}>
      <form>
        <InputOutputSection prefix={prefix} />
      </form>
    </FormProvider>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('InputOutputSection', () => {
  it('renders empty state for inputs with no rows', () => {
    renderWithProviders(<InputsFormWrapper prefix="inputs" />, {
      apolloMocks: [emptyRefDataMock],
    });

    expect(screen.getByText(/no inputs defined/i)).toBeInTheDocument();
  });

  it('renders empty state for outputs with no rows', () => {
    renderWithProviders(<InputsFormWrapper prefix="outputs" />, {
      apolloMocks: [emptyRefDataMock],
    });

    expect(screen.getByText(/no outputs defined/i)).toBeInTheDocument();
  });

  it('adds a new input row when "Add Input" is clicked', async () => {
    renderWithProviders(<InputsFormWrapper prefix="inputs" />, {
      apolloMocks: [emptyRefDataMock],
    });

    const addButton = screen.getByRole('button', { name: /add input/i });
    await userEvent.click(addButton);

    expect(screen.getByText('Input 1')).toBeInTheDocument();
  });

  it('adds a new output row when "Add Output" is clicked', async () => {
    renderWithProviders(<InputsFormWrapper prefix="outputs" />, {
      apolloMocks: [emptyRefDataMock],
    });

    const addButton = screen.getByRole('button', { name: /add output/i });
    await userEvent.click(addButton);

    expect(screen.getByText('Output 1')).toBeInTheDocument();
  });

  it('removes a row when the remove button is clicked', async () => {
    renderWithProviders(<InputsFormWrapper prefix="inputs" />, {
      apolloMocks: [emptyRefDataMock],
    });

    // Add two rows
    const addButton = screen.getByRole('button', { name: /add input/i });
    await userEvent.click(addButton);
    await userEvent.click(addButton);

    expect(screen.getByText('Input 1')).toBeInTheDocument();
    expect(screen.getByText('Input 2')).toBeInTheDocument();

    // Remove first row
    const removeButtons = screen.getAllByRole('button', { name: /remove input/i });
    const firstRemoveBtn = removeButtons[0];
    if (!firstRemoveBtn) throw new Error('No remove button found');
    await userEvent.click(firstRemoveBtn);

    await waitFor(() => {
      expect(screen.queryByText('Input 2')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Input 1')).toBeInTheDocument();
  });
});

describe('InputRow', () => {
  it('renders label, format, description fields', async () => {
    renderWithProviders(<InputsFormWrapper prefix="inputs" />, {
      apolloMocks: [emptyRefDataMock],
    });

    await userEvent.click(screen.getByRole('button', { name: /add input/i }));

    expect(screen.getByPlaceholderText('e.g. Precipitation')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. CSV, NetCDF')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Optional description')).toBeInTheDocument();
  });

  it('renders isOptional checkbox', async () => {
    renderWithProviders(<InputsFormWrapper prefix="inputs" />, {
      apolloMocks: [emptyRefDataMock],
    });

    await userEvent.click(screen.getByRole('button', { name: /add input/i }));

    expect(
      screen.getByText(/optional \(not required for model execution\)/i),
    ).toBeInTheDocument();
  });

  it('toggles collapsible variable overrides', async () => {
    renderWithProviders(<InputsFormWrapper prefix="inputs" />, {
      apolloMocks: [emptyRefDataMock],
    });

    await userEvent.click(screen.getByRole('button', { name: /add input/i }));

    // Overrides should be hidden initially
    expect(screen.queryByPlaceholderText('Override label')).not.toBeInTheDocument();

    // Open overrides
    await userEvent.click(screen.getByText(/variable label overrides/i));
    expect(screen.getByPlaceholderText('Override label')).toBeInTheDocument();

    // Close overrides
    await userEvent.click(screen.getByText(/variable label overrides/i));
    expect(screen.queryByPlaceholderText('Override label')).not.toBeInTheDocument();
  });
});
