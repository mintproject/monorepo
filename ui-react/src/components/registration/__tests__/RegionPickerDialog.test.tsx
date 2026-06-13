import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ListRegionCategoriesDocument } from '@/graphql/generated/graphql';
import { REGIONS_BY_CATEGORIES } from '@/graphql/region-picker';
import { renderWithProviders } from '@/test/utils/render';
import { RegionPickerDialog } from '@/components/registration/RegionPickerDialog';

const categoriesMock = {
  request: { query: ListRegionCategoriesDocument },
  result: {
    data: {
      region_category: [
        {
          __typename: 'region_category',
          id: 'agriculture',
          name: 'Agriculture',
          citation: null,
          sub_categories: [],
        },
        {
          __typename: 'region_category',
          id: 'hydrology',
          name: 'Hydrology',
          citation: null,
          sub_categories: [],
        },
      ],
    },
  },
};

const agricultureRegionsMock = {
  request: { query: REGIONS_BY_CATEGORIES, variables: { categoryIds: ['agriculture'] } },
  result: {
    data: {
      region: [{ __typename: 'region', id: 'tx', name: 'Texas', category_id: 'agriculture' }],
    },
  },
};

describe('RegionPickerDialog', () => {
  it('shows category tabs and lists regions for the active category', async () => {
    renderWithProviders(
      <RegionPickerDialog open onOpenChange={() => {}} selected={[]} onChange={() => {}} />,
      { apolloMocks: [categoriesMock, agricultureRegionsMock] },
    );

    expect(await screen.findByRole('tab', { name: /agricultural regions/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /hydrological regions/i })).toBeInTheDocument();
    expect(await screen.findByText('Texas')).toBeInTheDocument();
  });

  it('adds a region to the selection when clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <RegionPickerDialog open onOpenChange={() => {}} selected={[]} onChange={onChange} />,
      { apolloMocks: [categoriesMock, agricultureRegionsMock] },
    );

    await user.click(await screen.findByText('Texas'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([{ id: 'tx', label: 'Texas' }]));
  });
});
