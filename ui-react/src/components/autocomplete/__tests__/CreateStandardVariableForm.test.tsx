import { MockedProvider } from '@apollo/client/testing';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  CREATE_STANDARD_VARIABLE,
  CreateStandardVariableForm,
} from '@/components/autocomplete/CreateStandardVariableForm';

vi.mock('@/lib/uri', () => ({ generateMintUri: () => 'sv-new-id' }));

const createMock = {
  request: {
    query: CREATE_STANDARD_VARIABLE,
    variables: { id: 'sv-new-id', label: 'Albedo', description: null },
  },
  result: {
    data: {
      insert_modelcatalog_standard_variable_one: {
        __typename: 'modelcatalog_standard_variable',
        id: 'sv-new-id',
        label: 'Albedo',
        description: null,
      },
    },
  },
};

describe('CreateStandardVariableForm', () => {
  it('prefills the name and creates the variable, calling onCreated with the new record', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    render(
      <MockedProvider mocks={[createMock]}>
        <CreateStandardVariableForm initialName="Albedo" onCreated={onCreated} onCancel={vi.fn()} />
      </MockedProvider>,
    );

    expect(screen.getByLabelText(/name/i)).toHaveValue('Albedo');

    await user.click(screen.getByRole('button', { name: /create variable/i }));

    await waitFor(() =>
      expect(onCreated).toHaveBeenCalledWith({
        id: 'sv-new-id',
        label: 'Albedo',
        description: null,
      }),
    );
  });

  it('disables create when the name is empty and cancels', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <MockedProvider mocks={[]}>
        <CreateStandardVariableForm initialName="" onCreated={vi.fn()} onCancel={onCancel} />
      </MockedProvider>,
    );

    expect(screen.getByRole('button', { name: /create variable/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
