import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, waitFor } from '@/test/utils/render';
import type { Thread } from '@/graphql/generated/modeling';
import { FramingStep } from '../FramingStep';

vi.mock('../../SpatialScopeMap', () => ({
  SpatialScopeMap: () => <div data-testid="spatial-scope-map" />,
}));

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

describe('FramingStep', () => {
  it('disables Continue until Goal is non-empty', async () => {
    renderWithProviders(
      <FramingStep thread={makeThread()} onUpdated={vi.fn()} onContinue={vi.fn()} />,
    );
    expect(await screen.findByTestId('step-continue')).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/goal/i), 'Flood extent');
    await waitFor(() => expect(screen.getByTestId('step-continue')).toBeEnabled());
  });

  it('keeps the full spatial catalog available when no region is defined', async () => {
    renderWithProviders(
      <FramingStep thread={makeThread({ name: 'X' })} onUpdated={vi.fn()} onContinue={vi.fn()} />,
    );
    expect(await screen.findByTestId('spatial-scope-map')).toBeInTheDocument();
    await userEvent.click(await screen.findByTestId('toggle-region'));
    expect(screen.getByTestId('spatial-scope-map')).toBeInTheDocument();
  });

  it('renders the spatial map when an existing region is present', async () => {
    renderWithProviders(
      <FramingStep
        thread={makeThread({ name: 'X', region_id: 'texas' })}
        onUpdated={vi.fn()}
        onContinue={vi.fn()}
      />,
    );
    expect(await screen.findByTestId('spatial-scope-map')).toBeInTheDocument();
  });
});
