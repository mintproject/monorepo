/**
 * Tests for MintSummary — read-only summary report.
 */
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils/render';
import { MintSummary } from '../MintSummary';
import type { Thread } from '@/graphql/generated/modeling';

const baseThread: Thread = {
  __typename: 'thread',
  id: 'mint://thread/t1',
  name: 'My test thread',
  task_id: 'mint://task/task1',
  start_date: '2023-01-01',
  end_date: '2023-12-31',
  region_id: 'Ethiopia',
  driving_variable_id: 'fertilizer_amount__average',
  response_variable_id: 'cycles__crop_production',
  events: [
    {
      __typename: 'thread_provenance',
      event: 'CREATE',
      userid: 'alice',
      timestamp: '2023-01-01T00:00:00Z',
      notes: 'Initial setup',
    },
  ],
  permissions: [],
};

describe('MintSummary', () => {
  it('renders the summary container', () => {
    renderWithProviders(<MintSummary thread={baseThread} />);
    expect(screen.getByTestId('mint-summary')).toBeInTheDocument();
  });

  it('shows the thread name as goal', () => {
    renderWithProviders(<MintSummary thread={baseThread} />);
    expect(screen.getByText('My test thread')).toBeInTheDocument();
  });

  it('shows time period', () => {
    renderWithProviders(<MintSummary thread={baseThread} />);
    expect(screen.getByText(/2023-01-01.*2023-12-31/)).toBeInTheDocument();
  });

  it('shows region', () => {
    renderWithProviders(<MintSummary thread={baseThread} />);
    expect(screen.getByText('Ethiopia')).toBeInTheDocument();
  });

  it('shows response variable', () => {
    renderWithProviders(<MintSummary thread={baseThread} />);
    expect(screen.getByText('cycles__crop_production')).toBeInTheDocument();
  });

  it('shows driving variable', () => {
    renderWithProviders(<MintSummary thread={baseThread} />);
    expect(screen.getByText('fertilizer_amount__average')).toBeInTheDocument();
  });

  it('shows problem statement name when provided', () => {
    renderWithProviders(
      <MintSummary
        thread={baseThread}
        problemStatementName="Food Security Analysis"
        taskName="Crop production task"
      />,
    );
    expect(screen.getByText('Food Security Analysis')).toBeInTheDocument();
    expect(screen.getByText('Crop production task')).toBeInTheDocument();
  });

  it('shows placeholder text for models section', () => {
    renderWithProviders(<MintSummary thread={baseThread} />);
    expect(screen.getByText(/model selection details will be shown/i)).toBeInTheDocument();
  });

  it('shows placeholder text for datasets section', () => {
    renderWithProviders(<MintSummary thread={baseThread} />);
    expect(screen.getByText(/dataset binding details will be shown/i)).toBeInTheDocument();
  });

  it('shows section headers for all workflow sections', () => {
    renderWithProviders(<MintSummary thread={baseThread} />);
    expect(screen.getByText('General Framing')).toBeInTheDocument();
    expect(screen.getByText('Variables')).toBeInTheDocument();
    expect(screen.getByText('Models')).toBeInTheDocument();
    expect(screen.getByText('Datasets')).toBeInTheDocument();
    expect(screen.getByText('Parameters')).toBeInTheDocument();
    expect(screen.getByText('Model Runs and Results')).toBeInTheDocument();
  });
});
