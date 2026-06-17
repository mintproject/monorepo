import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/utils/render';
import { FacetSelect } from '@/components/models-browse/FacetSelect';

const options = [
  { id: 'r1', label: 'Texas' },
  { id: 'r2', label: 'Iowa' },
];

describe('FacetSelect', () => {
  it('renders the label and a count badge when items are selected', () => {
    renderWithProviders(
      <FacetSelect label="Region" options={options} selectedIds={['r1']} onChange={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /region/i })).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('toggles an option on select', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <FacetSelect label="Region" options={options} selectedIds={[]} onChange={onChange} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /region/i }));
    await userEvent.click(await screen.findByText('Iowa'));

    expect(onChange).toHaveBeenCalledWith(['r2']);
  });

  it('removes an already-selected option', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <FacetSelect label="Region" options={options} selectedIds={['r1']} onChange={onChange} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /region/i }));
    await userEvent.click(await screen.findByText('Texas'));

    expect(onChange).toHaveBeenCalledWith([]);
  });
});
