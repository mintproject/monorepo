import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from '../ErrorBoundary';

// Component that throws on render
function Bomb({ shouldThrow = false }: { shouldThrow?: boolean }) {
  if (shouldThrow) throw new Error('Test explosion');
  return <div>Content OK</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Content OK')).toBeInTheDocument();
  });

  it('renders default error UI when child throws', () => {
    // Suppress console.error from ErrorBoundary and React internals
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test explosion')).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('renders custom fallback when provided and child throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary fallback={<p>Custom fallback</p>}>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Custom fallback')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('shows Try Again button in error state', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
