import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { GetModelFamiliesDocument } from '@/graphql/generated/graphql';
import { renderWithProviders } from '@/test/utils/render';
import { ModelFamilyPicker } from '@/components/registration/ModelFamilyPicker';
import type { ModelFamilyLink } from '@/schemas/registration';

const familiesMock = {
  request: { query: GetModelFamiliesDocument },
  result: {
    data: {
      modelcatalog_software: [
        {
          id: 's-modflow',
          label: 'Modflow',
          versions: [
            { id: 'v-2000', label: '2000', version_id: '2000' },
            { id: 'v-2013', label: '2013', version_id: '2013' },
          ],
        },
      ],
    },
  },
};

function setup(value: ModelFamilyLink = { mode: 'none' }) {
  const onChange = vi.fn();
  renderWithProviders(<ModelFamilyPicker value={value} onChange={onChange} />, {
    apolloMocks: [familiesMock],
  });
  return { onChange };
}

describe('ModelFamilyPicker', () => {
  it('starts unlinked and shows the link control', () => {
    setup();
    expect(screen.getByRole('button', { name: /link a model family/i })).toBeInTheDocument();
  });

  it('lists Software — Version pairs and emits an existing selection', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();

    await user.click(screen.getByRole('button', { name: /link a model family/i }));

    await waitFor(() => expect(screen.getByText('Modflow — 2013')).toBeInTheDocument());
    await user.click(screen.getByText('Modflow — 2013'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'existing',
        softwareId: 's-modflow',
        versionId: 'v-2013',
        versionLabel: '2013',
      }),
    );
  });

  it('switches to create-new mode and emits a new family link', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();

    await user.click(screen.getByRole('button', { name: /create a new family/i }));

    await user.type(screen.getByLabelText(/family name/i), 'PIHM');
    await user.type(screen.getByLabelText(/^version$/i), '2024.1');

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: 'new', familyName: 'PIHM', versionName: '2024.1' }),
    );
  });
});
