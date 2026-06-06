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
  it('renders label, data type, default, fixed, min, max fields', async () => {
    renderWithProviders(<ParametersFormWrapper />);
    await userEvent.click(screen.getByRole('button', { name: /add parameter/i }));

    expect(screen.getByPlaceholderText('e.g. Threshold')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Default')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Fixed (overrides default)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Minimum')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Maximum')).toBeInTheDocument();
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
});
