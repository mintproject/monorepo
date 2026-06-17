/**
 * Tests for ConfigurationDetail component.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { GetConfigurationDocument } from '@/graphql/generated/graphql';
import { renderWithProviders } from '@/test/utils/render';
import { ConfigurationDetail } from '@/components/configuration/ConfigurationDetail';

// ─── Mock data ────────────────────────────────────────────────────────────────

const mockConfig = {
  __typename: 'modelcatalog_configuration' as const,
  id: 'cfg1',
  label: 'Default Configuration',
  description: 'A test configuration',
  software_version_id: 'ver1',
  model_configuration_id: null,
  software_version: {
    __typename: 'modelcatalog_software_version' as const,
    version_id: '2.0',
    software: {
      __typename: 'modelcatalog_software' as const,
      id: 'm1',
      label: 'TopoFlow',
    },
  },
  time_intervals: [
    {
      __typename: 'modelcatalog_configuration_time_interval' as const,
      time_interval: {
        __typename: 'modelcatalog_time_interval' as const,
        id: 'ti1',
        label: 'Daily',
        description: null,
        interval_unit: 'day',
        interval_value: '1',
      },
    },
  ],
  inputs: [
    {
      __typename: 'modelcatalog_configuration_input' as const,
      is_optional: false,
      input: {
        __typename: 'modelcatalog_dataset_specification' as const,
        id: 'ds1',
        label: 'Precipitation',
        description: 'Daily precipitation',
        has_format: 'CSV',
        has_dimensionality: null,
        position: 0,
        presentations: [
          {
            __typename: 'modelcatalog_dataset_specification_presentation' as const,
            presentation: {
              __typename: 'modelcatalog_variable_presentation' as const,
              id: 'vp1',
              label: 'Precipitation VP',
              has_long_name: null,
              has_short_name: null,
              standard_variable: {
                __typename: 'modelcatalog_standard_variable' as const,
                id: 'sv1',
                label: 'precipitation',
                description: null,
              },
              unit: {
                __typename: 'modelcatalog_unit' as const,
                id: 'u1',
                label: 'mm',
              },
            },
          },
        ],
      },
    },
  ],
  outputs: [],
  parameters: [
    {
      __typename: 'modelcatalog_configuration_parameter' as const,
      parameter: {
        __typename: 'modelcatalog_parameter' as const,
        id: 'param1',
        label: 'Threshold',
        description: null,
        has_data_type: 'float',
        has_default_value: '0.5',
        has_minimum_accepted_value: '0',
        has_maximum_accepted_value: '1',
        has_fixed_value: null,
        has_accepted_values: null,
        position: 0,
        parameter_type: null,
      },
    },
  ],
  authors: [
    {
      __typename: 'modelcatalog_configuration_author' as const,
      person: {
        __typename: 'modelcatalog_person' as const,
        id: 'person1',
        label: 'Alice',
      },
    },
  ],
  regions: [
    {
      __typename: 'modelcatalog_configuration_region' as const,
      region: {
        __typename: 'modelcatalog_region' as const,
        id: 'reg1',
        label: 'Ethiopia',
      },
    },
  ],
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ConfigurationDetail', () => {
  it('renders loading state initially', () => {
    renderWithProviders(<ConfigurationDetail configurationId="cfg1" />, {
      apolloMocks: [configQueryMock],
    });
    // Loading spinner should be present
    expect(
      document.querySelector('[class*=animate-spin]') ?? screen.queryByRole('status'),
    ).toBeTruthy();
  });

  it('renders configuration details after loading', async () => {
    renderWithProviders(<ConfigurationDetail configurationId="cfg1" />, {
      apolloMocks: [configQueryMock],
    });

    await waitFor(() => {
      expect(screen.getByText('Default Configuration')).toBeInTheDocument();
    });

    expect(screen.getByText('A test configuration')).toBeInTheDocument();
    expect(screen.getByText('Precipitation')).toBeInTheDocument();
    expect(screen.getByText('CSV')).toBeInTheDocument();
    expect(screen.getByText('precipitation')).toBeInTheDocument();
    expect(screen.getByText('mm')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Ethiopia')).toBeInTheDocument();
  });

  it('shows "Required" badge for non-optional inputs', async () => {
    renderWithProviders(<ConfigurationDetail configurationId="cfg1" />, {
      apolloMocks: [configQueryMock],
    });

    await waitFor(() => {
      expect(screen.getByText('Required')).toBeInTheDocument();
    });
  });

  it('shows Edit button when onEdit is provided', async () => {
    const onEdit = vi.fn();
    renderWithProviders(<ConfigurationDetail configurationId="cfg1" onEdit={onEdit} />, {
      apolloMocks: [configQueryMock],
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('shows a Configure link to the configure page when onEdit is absent', async () => {
    renderWithProviders(<ConfigurationDetail configurationId="cfg1" />, {
      apolloMocks: [configQueryMock],
    });

    const link = await screen.findByRole('link', { name: /configure/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('/models/configure/'));
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
  });

  it('renders model name, version badge, and time period', async () => {
    renderWithProviders(<ConfigurationDetail configurationId="cfg1" />, {
      apolloMocks: [configQueryMock],
    });

    await waitFor(() => {
      expect(screen.getByText('TopoFlow')).toBeInTheDocument();
    });
    expect(screen.getByText('2.0')).toBeInTheDocument();
    expect(screen.getByText('Time Period')).toBeInTheDocument();
    expect(screen.getByText('Daily')).toBeInTheDocument();
  });

  it('renders parameter details', async () => {
    renderWithProviders(<ConfigurationDetail configurationId="cfg1" />, {
      apolloMocks: [configQueryMock],
    });

    await waitFor(() => {
      expect(screen.getByText('Threshold')).toBeInTheDocument();
    });

    expect(screen.getByText('float')).toBeInTheDocument();
    expect(screen.getByText('0.5')).toBeInTheDocument();
  });
});
