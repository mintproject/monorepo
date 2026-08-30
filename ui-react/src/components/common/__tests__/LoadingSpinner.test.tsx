import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LoadingSpinner } from '../LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders with default size', () => {
    const { container } = render(<LoadingSpinner />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
    expect(spinner?.className).toContain('h-8');
  });

  it('renders with small size', () => {
    const { container } = render(<LoadingSpinner size="sm" />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner?.className).toContain('h-4');
  });

  it('renders with large size', () => {
    const { container } = render(<LoadingSpinner size="lg" />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner?.className).toContain('h-12');
  });

  it('accepts custom className', () => {
    const { container } = render(<LoadingSpinner className="mt-4" />);
    expect(container.firstChild).toHaveClass('mt-4');
  });
});
