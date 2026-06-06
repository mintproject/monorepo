/**
 * Tests for ConfigurationForm component.
 *
 * Tests focus on form rendering, validation, and mutation calls.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  GetConfigurationDocument,
  PrefetchReferenceDataDocument,
  UpdateConfigurationDocument,
  GetRegionsDocument,
} from '@/graphql/generated/graphql';
import { renderWithProviders } from '@/test/utils/render';
import { ConfigurationForm } from '../ConfigurationForm';

// ─── Mock data ────────────────────────────────────────────────────────────────

const mockConfig = {
  __typename: 'modelcatalog_configuration' as const,
  id: 'cfg1',
  label: 'Default Configuration',
  description: 'Test desc',
  software_version_id: 'ver1',
  model_configuration_id: null,
  inputs: [],
  outputs: [],
  parameters: [],
  authors: [],
  regions: [],
};

const configQueryMock = {
  request: {
    query: GetConfigurationDocument,
    variables: { id: 'cfg1' },
  },
  result: {
    data: { modelcatalog_configuration_by_pk: mockConfig },
  },
};

const emptyRefDataMock = {
  request: { query: PrefetchReferenceDataDocument },
  result: {
    data: {
      modelcatalog_standard_variable: [],
      modelcatalog_unit: [],
    },
  },
};

const emptyRegionsMock = {
  request: { query: GetRegionsDocument },
  result: { data: { modelcatalog_region: [] } },
};

const updateConfigMock = {
  request: {
    query: UpdateConfigurationDocument,
    variables: {
      id: 'cfg1',
      label: 'Updated Name',
      description: 'Test desc',
    },
  },
  result: {
    data: {
      update_modelcatalog_configuration_by_pk: {
        __typename: 'modelcatalog_configuration' as const,
        id: 'cfg1',
        label: 'Updated Name',
        description: 'Test desc',
        software_version_id: 'ver1',
        model_configuration_id: null,
      },
    },
  },
};

const defaultMocks = [configQueryMock, emptyRefDataMock, emptyRegionsMock];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ConfigurationForm (edit mode)', () => {
  it('renders loading state when configuration is loading', () => {
    renderWithProviders(<ConfigurationForm configurationId="cfg1" />, {
      apolloMocks: defaultMocks,
    });

    expect(
      document.querySelector('[class*=animate-spin]') ?? screen.queryByRole('status'),
    ).toBeTruthy();
  });

  it('populates form with existing configuration data', async () => {
    renderWithProviders(<ConfigurationForm configurationId="cfg1" />, {
      apolloMocks: defaultMocks,
    });

    await waitFor(() => {
      const nameInput = screen.getByPlaceholderText('Configuration name') as HTMLInputElement;
      expect(nameInput.value).toBe('Default Configuration');
    });
  });

  it('shows validation error when label is cleared', async () => {
    renderWithProviders(<ConfigurationForm configurationId="cfg1" />, {
      apolloMocks: defaultMocks,
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Configuration name')).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText('Configuration name');
    await userEvent.clear(nameInput);
    await userEvent.tab(); // trigger blur/change

    const submitButton = screen.getByRole('button', { name: /save changes/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Configuration name is required')).toBeInTheDocument();
    });
  });

  it('calls onCancel when Cancel button is clicked', async () => {
    const onCancel = vi.fn();
    renderWithProviders(<ConfigurationForm configurationId="cfg1" onCancel={onCancel} />, {
      apolloMocks: defaultMocks,
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('renders all major form sections', async () => {
    renderWithProviders(<ConfigurationForm configurationId="cfg1" />, {
      apolloMocks: defaultMocks,
    });

    await waitFor(() => {
      expect(screen.getByText('Configuration Details')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Inputs')).toBeInTheDocument();
    expect(screen.getByLabelText('Outputs')).toBeInTheDocument();
    expect(screen.getByLabelText('Parameters')).toBeInTheDocument();
    expect(screen.getByLabelText('Authors')).toBeInTheDocument();
    expect(screen.getByLabelText('Regions')).toBeInTheDocument();
  });

  it('calls onSaved after successful save', async () => {
    const onSaved = vi.fn();
    renderWithProviders(<ConfigurationForm configurationId="cfg1" onSaved={onSaved} />, {
      apolloMocks: [...defaultMocks, updateConfigMock],
    });

    await waitFor(() => {
      const nameInput = screen.getByPlaceholderText('Configuration name') as HTMLInputElement;
      expect(nameInput.value).toBe('Default Configuration');
    });

    // Change the label to make the form dirty
    const nameInput = screen.getByPlaceholderText('Configuration name');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Updated Name');

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith('cfg1');
    });
  });
});
