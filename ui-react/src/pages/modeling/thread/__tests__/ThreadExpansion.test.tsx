/**
 * Tests for ThreadExpansion — the reusable collapsible panel component.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils/render';
import { ThreadExpansion } from '../ThreadExpansion';

const mockViewContent = <div data-testid="view-content">View</div>;
const mockEditContent = <div data-testid="edit-content">Edit form</div>;

describe('ThreadExpansion', () => {
  it('renders collapsed by default', () => {
    renderWithProviders(
      <ThreadExpansion
        name="Test Panel"
        description="Test description"
        status="warning"
        statusInfo="Open to configure"
        viewContent={mockViewContent}
      />,
    );
    expect(screen.getByText('Test Panel')).toBeInTheDocument();
    expect(screen.queryByTestId('view-content')).not.toBeInTheDocument();
    expect(screen.getByText('Open to configure')).toBeInTheDocument();
  });

  it('expands when header is clicked', () => {
    renderWithProviders(
      <ThreadExpansion
        name="Test Panel"
        description="Test description"
        status="warning"
        statusInfo="Open to configure"
        viewContent={mockViewContent}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /test panel/i }));
    expect(screen.getByTestId('view-content')).toBeInTheDocument();
  });

  it('renders open when defaultOpen=true', () => {
    renderWithProviders(
      <ThreadExpansion
        name="Test Panel"
        description="Test description"
        status="done"
        statusInfo="Done"
        defaultOpen
        viewContent={mockViewContent}
      />,
    );
    expect(screen.getByTestId('view-content')).toBeInTheDocument();
    // Status info not shown when open
    expect(screen.queryByText('Done')).not.toBeInTheDocument();
  });

  it('shows edit button when canEdit=true and open', () => {
    renderWithProviders(
      <ThreadExpansion
        name="Test Panel"
        description="Test description"
        status="warning"
        statusInfo="info"
        defaultOpen
        canEdit
        viewContent={mockViewContent}
        editContent={mockEditContent}
      />,
    );
    expect(screen.getByRole('button', { name: /edit test panel/i })).toBeInTheDocument();
  });

  it('switches to edit mode when Edit is clicked', () => {
    renderWithProviders(
      <ThreadExpansion
        name="Test Panel"
        description="Test description"
        status="warning"
        statusInfo="info"
        defaultOpen
        canEdit
        viewContent={mockViewContent}
        editContent={mockEditContent}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /edit test panel/i }));
    expect(screen.getByTestId('edit-content')).toBeInTheDocument();
    expect(screen.queryByTestId('view-content')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('calls onSave and exits edit mode', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <ThreadExpansion
        name="Test Panel"
        description="Test description"
        status="warning"
        statusInfo="info"
        defaultOpen
        canEdit
        viewContent={mockViewContent}
        editContent={mockEditContent}
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /edit test panel/i }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledOnce();
    });
    await waitFor(() => {
      expect(screen.getByTestId('view-content')).toBeInTheDocument();
    });
  });

  it('calls onCancel and restores view mode', () => {
    const onCancel = vi.fn();
    renderWithProviders(
      <ThreadExpansion
        name="Test Panel"
        description="Test description"
        status="warning"
        statusInfo="info"
        defaultOpen
        canEdit
        viewContent={mockViewContent}
        editContent={mockEditContent}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /edit test panel/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(screen.getByTestId('view-content')).toBeInTheDocument();
  });

  it('shows done status indicator with correct styling', () => {
    renderWithProviders(
      <ThreadExpansion
        name="Done Panel"
        description="desc"
        status="done"
        statusInfo="info"
        viewContent={mockViewContent}
      />,
    );
    // The ✓ icon should appear with green styling
    const indicator = screen.getByText('✓');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveClass('text-green-600');
  });

  it('shows error status indicator with correct styling', () => {
    renderWithProviders(
      <ThreadExpansion
        name="Error Panel"
        description="desc"
        status="error"
        statusInfo="info"
        viewContent={mockViewContent}
      />,
    );
    const indicator = screen.getByText('✕');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveClass('text-red-500');
  });
});
