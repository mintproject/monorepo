/**
 * Tests for RegisterPage — the /models/register route.
 *
 * RegisterPage is a thin protected-route wrapper that hosts CreateModelForm.
 * These tests verify the page chrome (heading + description) and that the
 * config-first creation form is mounted underneath it.
 */
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { GetRegionsDocument, GetModelFamiliesDocument } from '@/graphql/generated/graphql';
import { renderWithProviders } from '@/test/utils/render';
import { RegisterPage } from '@/pages/RegisterPage';

// CreateModelForm navigates on submit; stub the router hook so mounting it
// inside the page does not depend on a real navigation target.
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => vi.fn(),
}));

// CreateModelForm fires these two queries on mount (regions + model families).
const regions = {
  request: { query: GetRegionsDocument },
  result: { data: { modelcatalog_region: [] } },
};
const families = {
  request: { query: GetModelFamiliesDocument },
  result: { data: { modelcatalog_software: [] } },
};

describe('RegisterPage', () => {
  it('renders the page heading and description', () => {
    renderWithProviders(<RegisterPage />, { apolloMocks: [regions, families] });

    expect(screen.getByRole('heading', { level: 1, name: /register model/i })).toBeInTheDocument();
    // The page chrome and the form card share the same blurb, so it appears
    // more than once — assert it is present rather than unique.
    expect(screen.getAllByText(/linking it to a model family is optional/i).length).toBeGreaterThan(
      0,
    );
  });

  it('mounts the CreateModelForm with its submit action', () => {
    renderWithProviders(<RegisterPage />, { apolloMocks: [regions, families] });

    expect(screen.getByRole('heading', { name: /create a new model/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create model/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/model name/i)).toBeInTheDocument();
  });
});
