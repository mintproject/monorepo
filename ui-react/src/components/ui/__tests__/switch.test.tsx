import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Switch } from '@/components/ui/switch';

describe('Switch', () => {
  it('exposes switch semantics and reflects checked state', () => {
    render(<Switch checked={false} onCheckedChange={() => {}} aria-label="Toggle" />);
    const el = screen.getByRole('switch', { name: /toggle/i });
    expect(el).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onCheckedChange with the next value when clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onChange} aria-label="Toggle" />);
    await user.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not fire when disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onChange} disabled aria-label="Toggle" />);
    await user.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
