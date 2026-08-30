import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  GetRegionsDocument,
  GetModelFamiliesDocument,
  CreateConfigurationDocument,
} from '@/graphql/generated/graphql';
import { renderWithProviders } from '@/test/utils/render';
import { CreateModelForm } from '@/components/registration/CreateModelForm';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigateMock,
}));

const regions = {
  request: { query: GetRegionsDocument },
  result: { data: { modelcatalog_region: [] } },
};
const families = {
  request: { query: GetModelFamiliesDocument },
  result: { data: { modelcatalog_software: [] } },
};

describe('CreateModelForm', () => {
  it('renders a single form with no stepper', () => {
    renderWithProviders(<CreateModelForm />, { apolloMocks: [regions, families] });
    expect(screen.queryByRole('navigation', { name: /registration steps/i })).toBeNull();
    expect(screen.getByRole('heading', { name: /create a new model/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create model/i })).toBeInTheDocument();
  });

  it('blocks submit when the model name is empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateModelForm />, { apolloMocks: [regions, families] });
    await user.click(screen.getByRole('button', { name: /create model/i }));
    expect(await screen.findByText(/model name is required/i)).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('creates a standalone configuration and navigates on success', async () => {
    const user = userEvent.setup();
    navigateMock.mockClear();
    const createConfig = {
      request: { query: CreateConfigurationDocument },
      variableMatcher: () => true,
      result: {
        data: {
          insert_modelcatalog_configuration_one: {
            id: 'cfg-1',
            label: 'Modflow · Barton Springs',
            software_version_id: null,
          },
        },
      },
    };

    renderWithProviders(<CreateModelForm />, {
      apolloMocks: [regions, families, createConfig],
    });

    await user.type(screen.getByLabelText(/model name/i), 'Modflow · Barton Springs');
    await user.click(screen.getByRole('button', { name: /create model/i }));

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith(expect.stringContaining('/models/configure/')),
    );
  });
});
