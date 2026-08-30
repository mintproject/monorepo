import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from '../ConfirmDialog';

function renderDialog(
  overrides: {
    open?: boolean;
    onConfirm?: () => void;
    onOpenChange?: (open: boolean) => void;
  } = {},
) {
  const onConfirm = overrides.onConfirm ?? vi.fn();
  const onOpenChange = overrides.onOpenChange ?? vi.fn();
  return {
    onConfirm,
    onOpenChange,
    ...render(
      <ConfirmDialog
        open={overrides.open ?? true}
        onOpenChange={onOpenChange}
        title="Delete item"
        description="Are you sure you want to delete this item?"
        onConfirm={onConfirm}
      />,
    ),
  };
}

describe('ConfirmDialog', () => {
  it('renders title and description when open', () => {
    renderDialog();
    expect(screen.getByText('Delete item')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete this item?')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    renderDialog({ open: false });
    expect(screen.queryByText('Delete item')).not.toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', async () => {
    const { onConfirm } = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onOpenChange(false) when cancel button is clicked', async () => {
    const { onOpenChange } = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows custom confirm label when provided', () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Remove"
        description="This action cannot be undone."
        onConfirm={vi.fn()}
        confirmLabel="Yes, remove"
      />,
    );
    expect(screen.getByRole('button', { name: /yes, remove/i })).toBeInTheDocument();
  });
});
