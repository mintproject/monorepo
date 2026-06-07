import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilteredByBanner } from '../FilteredByBanner';

describe('FilteredByBanner', () => {
  it('renders each chip with its value and source suffix', () => {
    render(
      <FilteredByBanner
        chips={[
          { icon: '⌖', label: 'Region', value: 'Texas Gulf', source: 'from Framing' },
          { icon: '🗓', label: 'Dates', value: '2000–2026', source: 'from Framing' },
        ]}
      />,
    );
    expect(screen.getByText('Texas Gulf')).toBeInTheDocument();
    expect(screen.getAllByText('from Framing')).toHaveLength(2);
  });

  it('renders nothing when there are no chips', () => {
    const { container } = render(<FilteredByBanner chips={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('fires onEdit when the edit link is clicked', async () => {
    const onEdit = vi.fn();
    render(
      <FilteredByBanner
        chips={[{ icon: '⌖', label: 'Region', value: 'Texas Gulf' }]}
        editLabel="edit region"
        onEdit={onEdit}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'edit region' }));
    expect(onEdit).toHaveBeenCalled();
  });
});
