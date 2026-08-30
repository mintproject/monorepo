/**
 * Tests for MintConfigure — orchestrates 3 expansion panels.
 */
import { describe, expect, it, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils/render';
import { MintConfigure } from '../MintConfigure';
import type { Thread } from '@/graphql/generated/modeling';

const mockThread: Thread = {
  __typename: 'thread',
  id: 'mint://thread/t1',
  name: 'Test thread',
  task_id: 'mint://task/task1',
  start_date: '2023-01-01',
  end_date: '2023-12-31',
  region_id: 'Ethiopia',
  driving_variable_id: null,
  response_variable_id: null,
  events: [],
  permissions: [],
};

describe('MintConfigure', () => {
  it('renders the configure, models and datasets panels', () => {
    renderWithProviders(<MintConfigure thread={mockThread} onContinue={vi.fn()} />);
    expect(screen.getByText('General framing')).toBeInTheDocument();
    expect(screen.getByText('Select models')).toBeInTheDocument();
    expect(screen.getByText('Select datasets')).toBeInTheDocument();
  });

  it('renders the "Select & Continue" button', () => {
    renderWithProviders(<MintConfigure thread={mockThread} onContinue={vi.fn()} />);
    expect(screen.getByTestId('configure-continue')).toBeInTheDocument();
  });

  it('calls onContinue when Continue is clicked', () => {
    const onContinue = vi.fn();
    renderWithProviders(<MintConfigure thread={mockThread} onContinue={onContinue} />);
    fireEvent.click(screen.getByTestId('configure-continue'));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('shows the sub-task description text', () => {
    renderWithProviders(<MintConfigure thread={mockThread} onContinue={vi.fn()} />);
    expect(screen.getByText(/general configuration for this sub-task/i)).toBeInTheDocument();
  });
});
