/**
 * Tests for ModelRegistrationWizard and related step components.
 *
 * Tests cover:
 * - Wizard renders step indicators and step content correctly
 * - Per-step validation blocks advancing without required fields
 * - Navigation (Next / Back) works correctly
 * - RegisterPage wraps the wizard
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { PrefetchReferenceDataDocument, GetRegionsDocument } from '@/graphql/generated/graphql';
import { renderWithProviders } from '@/test/utils/render';
import { ModelRegistrationWizard } from '@/components/registration/ModelRegistrationWizard';
import { RegisterPage } from '@/pages/RegisterPage';

// ─── Shared mocks ─────────────────────────────────────────────────────────────

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

// ─── Tests: Wizard rendering ──────────────────────────────────────────────────

describe('ModelRegistrationWizard', () => {
  it('renders step 1 (Software) initially', () => {
    renderWithProviders(<ModelRegistrationWizard />, {
      apolloMocks: [emptyRefDataMock, emptyRegionsMock],
    });

    // The card heading is the h3 with role heading
    expect(screen.getByRole('heading', { name: 'Software' })).toBeInTheDocument();
    expect(screen.getByText('Model metadata')).toBeInTheDocument();
    // Step indicator nav present
    expect(screen.getByRole('navigation', { name: 'Registration steps' })).toBeInTheDocument();
  });

  it('renders step indicators for all three steps', () => {
    renderWithProviders(<ModelRegistrationWizard />, {
      apolloMocks: [emptyRefDataMock, emptyRegionsMock],
    });

    const nav = screen.getByRole('navigation', { name: 'Registration steps' });
    expect(nav).toBeInTheDocument();
    // All three step labels appear inside the nav
    expect(nav).toHaveTextContent('Software');
    expect(nav).toHaveTextContent('Version');
    expect(nav).toHaveTextContent('Configuration');
  });

  it('shows "Next" button and disabled "Back" button on step 1', () => {
    renderWithProviders(<ModelRegistrationWizard />, {
      apolloMocks: [emptyRefDataMock, emptyRegionsMock],
    });

    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back/i })).toBeDisabled();
  });

  it('shows required fields on step 1', () => {
    renderWithProviders(<ModelRegistrationWizard />, {
      apolloMocks: [emptyRefDataMock, emptyRegionsMock],
    });

    expect(screen.getByLabelText(/model name/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument(); // Type select
  });
});

// ─── Tests: Step 1 validation ─────────────────────────────────────────────────

describe('ModelRegistrationWizard — step 1 validation', () => {
  it('blocks advancing when Model Name is empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ModelRegistrationWizard />, {
      apolloMocks: [emptyRefDataMock, emptyRegionsMock],
    });

    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText(/model name is required/i)).toBeInTheDocument();
    });

    // Still on step 1
    expect(screen.getByRole('heading', { name: 'Software' })).toBeInTheDocument();
  });

  it('advances to step 2 when step 1 is valid', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ModelRegistrationWizard />, {
      apolloMocks: [emptyRefDataMock, emptyRegionsMock],
    });

    await user.type(screen.getByLabelText(/model name/i), 'Test Model');
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Version' })).toBeInTheDocument();
    });
  });
});

// ─── Tests: Step 2 (Version) ──────────────────────────────────────────────────

describe('ModelRegistrationWizard — step 2', () => {
  async function navigateToStep2() {
    const user = userEvent.setup();
    renderWithProviders(<ModelRegistrationWizard />, {
      apolloMocks: [emptyRefDataMock, emptyRegionsMock],
    });

    await user.type(screen.getByLabelText(/model name/i), 'Test Model');
    await user.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Version' })).toBeInTheDocument();
    });

    return user;
  }

  it('renders Version fields on step 2', async () => {
    await navigateToStep2();

    expect(screen.getByLabelText(/version label/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/version id/i)).toBeInTheDocument();
  });

  it('enables Back button on step 2', async () => {
    await navigateToStep2();

    expect(screen.getByRole('button', { name: /back/i })).not.toBeDisabled();
  });

  it('goes back to step 1 when Back is clicked', async () => {
    const user = await navigateToStep2();

    await user.click(screen.getByRole('button', { name: /back/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Software' })).toBeInTheDocument();
    });
  });

  it('blocks advancing from step 2 without Version Label', async () => {
    const user = await navigateToStep2();

    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText(/version label is required/i)).toBeInTheDocument();
    });

    // Still on step 2
    expect(screen.getByRole('heading', { name: 'Version' })).toBeInTheDocument();
  });

  it('advances to step 3 when step 2 is valid', async () => {
    const user = await navigateToStep2();

    await user.type(screen.getByLabelText(/version label/i), 'v1.0');
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Configuration' })).toBeInTheDocument();
    });
  });
});

// ─── Tests: Step 3 (Configuration) ───────────────────────────────────────────

describe('ModelRegistrationWizard — step 3', () => {
  async function navigateToStep3() {
    const user = userEvent.setup();
    renderWithProviders(<ModelRegistrationWizard />, {
      apolloMocks: [emptyRefDataMock, emptyRegionsMock],
    });

    // Step 1
    await user.type(screen.getByLabelText(/model name/i), 'Test Model');
    await user.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => screen.getByRole('heading', { name: 'Version' }));

    // Step 2
    await user.type(screen.getByLabelText(/version label/i), 'v1.0');
    await user.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => screen.getByRole('heading', { name: 'Configuration' }));

    return user;
  }

  it('renders Configuration fields on step 3', async () => {
    await navigateToStep3();

    expect(screen.getByLabelText(/configuration name/i)).toBeInTheDocument();
  });

  it('shows "Register Model" button on step 3', async () => {
    await navigateToStep3();

    expect(screen.getByRole('button', { name: /register model/i })).toBeInTheDocument();
  });

  it('blocks submit when Configuration Name is empty', async () => {
    const user = await navigateToStep3();

    await user.click(screen.getByRole('button', { name: /register model/i }));

    await waitFor(() => {
      expect(screen.getByText(/configuration name is required/i)).toBeInTheDocument();
    });
  });
});

// ─── Tests: RegisterPage ──────────────────────────────────────────────────────

describe('RegisterPage', () => {
  it('renders the wizard heading', () => {
    renderWithProviders(<RegisterPage />, {
      apolloMocks: [emptyRefDataMock, emptyRegionsMock],
    });

    expect(screen.getByText('Register Model')).toBeInTheDocument();
  });

  it('renders the wizard step indicator', () => {
    renderWithProviders(<RegisterPage />, {
      apolloMocks: [emptyRefDataMock, emptyRegionsMock],
    });

    expect(screen.getByRole('navigation', { name: 'Registration steps' })).toBeInTheDocument();
  });
});
