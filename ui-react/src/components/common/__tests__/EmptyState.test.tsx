import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No items found" />);
    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<EmptyState title="No items" description="Try adding one." />);
    expect(screen.getByText('Try adding one.')).toBeInTheDocument();
  });

  it('renders action when provided', () => {
    render(<EmptyState title="No items" action={<button>Add Item</button>} />);
    expect(screen.getByRole('button', { name: 'Add Item' })).toBeInTheDocument();
  });
});
