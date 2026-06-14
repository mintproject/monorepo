/**
 * Tests for ParameterSection and ParameterRow components.
 */
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { renderWithProviders } from '@/test/utils/render';
import { configurationFormSchema, type ConfigurationFormSchema } from '@/schemas/configuration';
import { ParameterSection } from '../ParameterSection';

// ─── Test wrapper ────────────────────────────────────────────────────────────

function ParametersFormWrapper() {
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
        <ParameterSection />
      </form>
    </FormProvider>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ParameterSection', () => {
  it('renders empty state when no parameters', () => {
    renderWithProviders(<ParametersFormWrapper />);
    expect(screen.getByText(/no parameters defined/i)).toBeInTheDocument();
  });

  it('adds a parameter row when "Add Parameter" is clicked', async () => {
    renderWithProviders(<ParametersFormWrapper />);

    await userEvent.click(screen.getByRole('button', { name: /add parameter/i }));
    expect(screen.getByText('Parameter 1')).toBeInTheDocument();
  });

  it('removes a parameter row', async () => {
    renderWithProviders(<ParametersFormWrapper />);

    await userEvent.click(screen.getByRole('button', { name: /add parameter/i }));
    await userEvent.click(screen.getByRole('button', { name: /add parameter/i }));

    expect(screen.getByText('Parameter 1')).toBeInTheDocument();
    expect(screen.getByText('Parameter 2')).toBeInTheDocument();

    const removes = screen.getAllByRole('button', { name: /remove parameter/i });
    const firstRemoveBtn = removes[0];
    if (!firstRemoveBtn) throw new Error('No remove button found');
    await userEvent.click(firstRemoveBtn);

    expect(screen.getByText('Parameter 1')).toBeInTheDocument();
    expect(screen.queryByText('Parameter 2')).not.toBeInTheDocument();
  });
});

describe('ParameterRow', () => {
  it('renders label, data type and default value; min/max and fixed hidden by default', async () => {
    renderWithProviders(<ParametersFormWrapper />);
    await userEvent.click(screen.getByRole('button', { name: /add parameter/i }));

    expect(screen.getByPlaceholderText('e.g. Threshold')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Default')).toBeInTheDocument();
    // Untyped (string-like) parameter: min/max are not meaningful, fixed is hidden.
    expect(screen.queryByPlaceholderText('Minimum')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Maximum')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^fixed value$/i)).not.toBeInTheDocument();
  });

  it('renders data type select with options', async () => {
    renderWithProviders(<ParametersFormWrapper />);
    await userEvent.click(screen.getByRole('button', { name: /add parameter/i }));

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    // Check some options exist
    expect(screen.getByRole('option', { name: 'float' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'integer' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'string' })).toBeInTheDocument();
  });

  it('shows Min/Max only for ordered types (integer/float/datetime)', async () => {
    renderWithProviders(<ParametersFormWrapper />);
    await userEvent.click(screen.getByRole('button', { name: /add parameter/i }));

    const typeSelect = screen.getByRole('combobox');

    // string → no bounds
    await userEvent.selectOptions(typeSelect, 'string');
    expect(screen.queryByPlaceholderText('Minimum')).not.toBeInTheDocument();

    // integer → bounds appear
    await userEvent.selectOptions(typeSelect, 'integer');
    expect(screen.getByPlaceholderText('Minimum')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Maximum')).toBeInTheDocument();

    // boolean → bounds gone again
    await userEvent.selectOptions(typeSelect, 'boolean');
    expect(screen.queryByPlaceholderText('Minimum')).not.toBeInTheDocument();
  });

  it('locking moves the default into the fixed value and hides default + min/max', async () => {
    renderWithProviders(<ParametersFormWrapper />);
    await userEvent.click(screen.getByRole('button', { name: /add parameter/i }));

    // Make it a bounded type and type a default value.
    await userEvent.selectOptions(screen.getByRole('combobox'), 'integer');
    const defaultInput = screen.getByPlaceholderText('Default');
    await userEvent.type(defaultInput, '42');
    expect(screen.getByPlaceholderText('Minimum')).toBeInTheDocument();

    // Lock it.
    await userEvent.click(screen.getByRole('switch', { name: /lock to a fixed value/i }));

    // Default + min/max are gone; a single fixed-value input holds the carried-over value.
    expect(screen.queryByPlaceholderText('Default')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Minimum')).not.toBeInTheDocument();
    const fixedInput = screen.getByPlaceholderText('Fixed value');
    expect(fixedInput).toHaveValue(42);

    // Unlock restores it to the default.
    await userEvent.click(screen.getByRole('switch', { name: /lock to a fixed value/i }));
    expect(screen.queryByPlaceholderText('Fixed value')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Default')).toHaveValue(42);
  });
});
