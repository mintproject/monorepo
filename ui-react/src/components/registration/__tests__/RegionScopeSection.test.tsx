import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { FormProvider, useForm } from 'react-hook-form';

import { renderWithProviders } from '@/test/utils/render';
import { Form } from '@/components/ui/form';
import { RegionScopeSection } from '@/components/registration/RegionScopeSection';
import { emptyCreateModel, type CreateModelSchema } from '@/schemas/registration';

function Harness({ defaults }: { defaults?: Partial<CreateModelSchema> }) {
  const form = useForm<CreateModelSchema>({
    defaultValues: { ...emptyCreateModel(), ...defaults },
  });
  return (
    <FormProvider {...form}>
      <Form {...form}>
        <RegionScopeSection />
      </Form>
    </FormProvider>
  );
}

describe('RegionScopeSection', () => {
  it('is off by default and hides the region picker controls', () => {
    renderWithProviders(<Harness />);
    expect(screen.getByRole('switch', { name: /region-specific/i })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.queryByRole('button', { name: /select regions/i })).toBeNull();
  });

  it('reveals the Select regions button when toggled on', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    await user.click(screen.getByRole('switch', { name: /region-specific/i }));
    expect(screen.getByRole('button', { name: /select regions/i })).toBeInTheDocument();
  });

  it('renders selected regions as removable chips when region-specific', () => {
    renderWithProviders(
      <Harness defaults={{ isRegionSpecific: true, regions: [{ id: 'tx', label: 'Texas' }] }} />,
    );
    expect(screen.getByText('Texas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit regions/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove texas/i })).toBeInTheDocument();
  });
});
