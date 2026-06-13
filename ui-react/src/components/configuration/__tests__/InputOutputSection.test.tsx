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

function InputsFormWrapper({
  prefix,
  allowMultipleVariables = false,
}: {
  prefix: 'inputs' | 'outputs';
  allowMultipleVariables?: boolean;
}) {
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
        <InputOutputSection prefix={prefix} allowMultipleVariables={allowMultipleVariables} />
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

    expect(screen.getByText(/optional \(not required for model execution\)/i)).toBeInTheDocument();
  });

  it('toggles collapsible long name / short name overrides', async () => {
    renderWithProviders(<InputsFormWrapper prefix="inputs" />, {
      apolloMocks: [emptyRefDataMock],
    });

    await userEvent.click(screen.getByRole('button', { name: /add input/i }));

    // Overrides should be hidden initially
    expect(screen.queryByPlaceholderText('Long name')).not.toBeInTheDocument();

    // Open overrides
    await userEvent.click(screen.getByText(/long name \/ short name/i));
    expect(screen.getByPlaceholderText('Long name')).toBeInTheDocument();

    // Close overrides
    await userEvent.click(screen.getByText(/long name \/ short name/i));
    expect(screen.queryByPlaceholderText('Long name')).not.toBeInTheDocument();
  });
});

describe('InputRow variables (presentations)', () => {
  it('shows a single fixed variable editor and no Add Variable button when single-presentation', async () => {
    renderWithProviders(<InputsFormWrapper prefix="inputs" />, {
      apolloMocks: [emptyRefDataMock],
    });

    await userEvent.click(screen.getByRole('button', { name: /add input/i }));

    // One presentation editor with Standard Variable + Unit fields
    expect(screen.getByText('Standard Variable')).toBeInTheDocument();
    expect(screen.getByText('Unit')).toBeInTheDocument();
    // No add/remove of variables in single-presentation mode
    expect(screen.queryByRole('button', { name: /add variable/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove variable/i })).not.toBeInTheDocument();
  });

  it('starts a new input with zero variables', async () => {
    renderWithProviders(<InputsFormWrapper prefix="inputs" allowMultipleVariables />, {
      apolloMocks: [emptyRefDataMock],
    });

    await userEvent.click(screen.getByRole('button', { name: /add input/i }));

    // No variables yet — empty state shown, no variable cards
    expect(screen.getByText(/this input carries zero standard variables/i)).toBeInTheDocument();
    expect(screen.queryByText('Variable 1')).not.toBeInTheDocument();
  });

  it('adds and removes variables when multiple are allowed', async () => {
    renderWithProviders(<InputsFormWrapper prefix="inputs" allowMultipleVariables />, {
      apolloMocks: [emptyRefDataMock],
    });

    await userEvent.click(screen.getByRole('button', { name: /add input/i }));

    // Add the first variable
    await userEvent.click(screen.getByRole('button', { name: /add variable/i }));
    expect(screen.getByText('Variable 1')).toBeInTheDocument();

    // Add a second variable
    await userEvent.click(screen.getByRole('button', { name: /add variable/i }));
    expect(screen.getByText('Variable 2')).toBeInTheDocument();

    // Remove the second variable
    const removeButtons = screen.getAllByRole('button', { name: /remove variable/i });
    await userEvent.click(removeButtons[1]!);
    await waitFor(() => {
      expect(screen.queryByText('Variable 2')).not.toBeInTheDocument();
    });
  });

  it('returns to the empty state after removing the last variable', async () => {
    renderWithProviders(<InputsFormWrapper prefix="inputs" allowMultipleVariables />, {
      apolloMocks: [emptyRefDataMock],
    });

    await userEvent.click(screen.getByRole('button', { name: /add input/i }));
    await userEvent.click(screen.getByRole('button', { name: /add variable/i }));
    expect(screen.getByText('Variable 1')).toBeInTheDocument();

    const removeButtons = screen.getAllByRole('button', { name: /remove variable/i });
    await userEvent.click(removeButtons[0]!);

    await waitFor(() => {
      expect(screen.getByText(/this input carries zero standard variables/i)).toBeInTheDocument();
    });
  });
});
