/**
 * Tests for MintVariables — variable selection step.
 */
import { describe, expect, it, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils/render';
import { MintVariables } from '../MintVariables';
import type { Thread } from '@/graphql/generated/modeling';

const baseThread: Thread = {
  __typename: 'thread',
  id: 'mint://thread/t1',
  name: 'Test thread',
  task_id: 'mint://task/task1',
  start_date: '2023-01-01',
  end_date: '2023-12-31',
  region_id: 'Ethiopia',
  driving_variable_id: null,
  response_variable_id: null,
  // 'testuser' created this thread — they get write permission
  events: [
    {
      __typename: 'thread_provenance',
      event: 'CREATE' as const,
      userid: 'testuser',
      timestamp: '2023-01-01T00:00:00Z',
      notes: null,
    },
  ],
  permissions: [],
};

describe('MintVariables', () => {
  it('shows edit form when no variables are selected', () => {
    renderWithProviders(<MintVariables thread={baseThread} onContinue={vi.fn()} />);
    expect(screen.getByTestId('variables-form')).toBeInTheDocument();
    expect(screen.getByLabelText(/indicator/i)).toBeInTheDocument();
  });

  it('shows view mode when thread has a response variable', () => {
    const thread: Thread = {
      ...baseThread,
      response_variable_id: 'cycles__crop_production',
    };
    renderWithProviders(<MintVariables thread={thread} onContinue={vi.fn()} />);
    expect(screen.queryByTestId('variables-form')).not.toBeInTheDocument();
    expect(screen.getByText('cycles__crop_production')).toBeInTheDocument();
  });

  it('shows Continue button in view mode', () => {
    const thread: Thread = {
      ...baseThread,
      response_variable_id: 'cycles__crop_production',
    };
    renderWithProviders(<MintVariables thread={thread} onContinue={vi.fn()} />);
    expect(screen.getByTestId('variables-continue')).toBeInTheDocument();
  });

  it('calls onContinue when Continue is clicked in view mode', () => {
    const onContinue = vi.fn();
    const thread: Thread = {
      ...baseThread,
      response_variable_id: 'cycles__crop_production',
    };
    renderWithProviders(<MintVariables thread={thread} onContinue={onContinue} />);
    fireEvent.click(screen.getByTestId('variables-continue'));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('allows editing variables when in view mode', () => {
    const thread: Thread = {
      ...baseThread,
      response_variable_id: 'cycles__crop_production',
    };
    renderWithProviders(<MintVariables thread={thread} onContinue={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /edit variables/i }));
    expect(screen.getByTestId('variables-form')).toBeInTheDocument();
  });

  it('shows submit button in edit mode', () => {
    renderWithProviders(<MintVariables thread={baseThread} onContinue={vi.fn()} />);
    expect(screen.getByTestId('variables-submit')).toBeInTheDocument();
    expect(screen.getByTestId('variables-submit')).toHaveTextContent('Select & Continue');
  });

  it('displays indicator and driving variable inputs', () => {
    renderWithProviders(<MintVariables thread={baseThread} onContinue={vi.fn()} />);
    expect(screen.getByLabelText(/indicator/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/adjustable variable/i)).toBeInTheDocument();
  });

  it('shows Cancel button in edit mode when thread already has variables', () => {
    const thread: Thread = {
      ...baseThread,
      response_variable_id: 'cycles__crop_production',
    };
    renderWithProviders(<MintVariables thread={thread} onContinue={vi.fn()} />);
    // Click edit icon to enter edit mode
    fireEvent.click(screen.getByRole('button', { name: /edit variables/i }));
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });
});
