import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormProvider, useForm } from 'react-hook-form';

import { GetModelFamiliesDocument, GetRegionsDocument } from '@/graphql/generated/graphql';
import { renderWithProviders } from '@/test/utils/render';
import { Form } from '@/components/ui/form';
import { OptionalDetailsSection } from '@/components/registration/OptionalDetailsSection';
import { emptyCreateModel, type CreateModelSchema } from '@/schemas/registration';

const familiesMock = {
  request: { query: GetModelFamiliesDocument },
  result: { data: { modelcatalog_software: [] } },
};
const regionsMock = {
  request: { query: GetRegionsDocument },
  result: { data: { modelcatalog_region: [] } },
};

function Harness() {
  const form = useForm<CreateModelSchema>({ defaultValues: emptyCreateModel() });
  return (
    <FormProvider {...form}>
      <Form {...form}>
        <OptionalDetailsSection />
      </Form>
    </FormProvider>
  );
}

describe('OptionalDetailsSection', () => {
  it('renders the optional block heading and metadata fields', () => {
    renderWithProviders(<Harness />, { apolloMocks: [familiesMock, regionsMock] });

    expect(screen.getByText(/optional details/i)).toBeInTheDocument();
    expect(screen.getByText(/model family/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/license/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/website/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/keywords/i)).toBeInTheDocument();
  });
});
