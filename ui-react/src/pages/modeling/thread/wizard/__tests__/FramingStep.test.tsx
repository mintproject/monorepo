import { describe, expect, it, vi } from 'vitest';
import type { MockedResponse } from '@apollo/client/testing';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, waitFor } from '@/test/utils/render';
import { LIST_TOP_REGIONS } from '@/graphql/queries/regions';
import type { Thread } from '@/graphql/generated/modeling';
import { FramingStep } from '../FramingStep';

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    __typename: 'thread',
    id: 't1',
    name: '',
    task_id: 'task1',
    start_date: '2000-01-01',
    end_date: '2026-01-01',
    region_id: null,
    driving_variable_id: null,
    response_variable_id: null,
    events: [],
    permissions: [
      { __typename: 'thread_permission', user_id: 'testuser', read: true, write: true },
    ],
    thread_models: [],
    ...overrides,
  };
}

const regionsMock: MockedResponse = {
  request: { query: LIST_TOP_REGIONS },
  result: {
    data: {
      region: [
        { id: 'texas', name: 'Texas Gulf', model_catalog_uri: null, geometries: [] },
        { id: 'ethiopia', name: 'Ethiopia', model_catalog_uri: null, geometries: [] },
      ],
    },
  },
};

describe('FramingStep', () => {
  it('disables Continue until Goal is non-empty', async () => {
    renderWithProviders(
      <FramingStep thread={makeThread()} onUpdated={vi.fn()} onContinue={vi.fn()} />,
      { apolloMocks: [regionsMock] },
    );
    expect(await screen.findByTestId('step-continue')).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/goal/i), 'Flood extent');
    await waitFor(() => expect(screen.getByTestId('step-continue')).toBeEnabled());
  });

  it('does not show region/date controls until their toggle is on', async () => {
    renderWithProviders(
      <FramingStep thread={makeThread({ name: 'X' })} onUpdated={vi.fn()} onContinue={vi.fn()} />,
      { apolloMocks: [regionsMock] },
    );
    expect(screen.queryByLabelText(/select a region/i)).not.toBeInTheDocument();
    await userEvent.click(await screen.findByTestId('toggle-region'));
    expect(await screen.findByLabelText(/select a region/i)).toBeInTheDocument();
  });

  it('renders the existing region as a chosen value', async () => {
    renderWithProviders(
      <FramingStep
        thread={makeThread({ name: 'X', region_id: 'texas' })}
        onUpdated={vi.fn()}
        onContinue={vi.fn()}
      />,
      { apolloMocks: [regionsMock] },
    );
    const select = await screen.findByLabelText('Select a region');
    expect(select).toHaveValue('texas');
  });
});
