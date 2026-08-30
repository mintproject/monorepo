import * as React from 'react';
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

/** Stateful harness: feeds value back like the real form does (controlled component). */
function Harness({
  spy,
  initial,
}: {
  spy: (v: ModelFamilyLink) => void;
  initial?: ModelFamilyLink;
}) {
  const [value, setValue] = React.useState<ModelFamilyLink>(initial ?? { mode: 'none' });
  return (
    <ModelFamilyPicker
      value={value}
      onChange={(v) => {
        spy(v);
        setValue(v);
      }}
    />
  );
}

function setup(initial?: ModelFamilyLink) {
  const onChange = vi.fn();
  renderWithProviders(<Harness spy={onChange} initial={initial} />, {
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

  it('clears an existing selection back to none', async () => {
    const user = userEvent.setup();
    const { onChange } = setup({
      mode: 'existing',
      softwareId: 's-modflow',
      softwareLabel: 'Modflow',
      versionId: 'v-2013',
      versionLabel: '2013',
    });

    await user.click(screen.getByRole('button', { name: /clear model family/i }));
    expect(onChange).toHaveBeenCalledWith({ mode: 'none' });
  });
});
