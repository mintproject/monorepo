/**
 * InputOutputSection — field array section for inputs or outputs.
 * Uses useFieldArray from React Hook Form. Reused for both inputs and outputs.
 */
import { useFieldArray, useFormContext } from 'react-hook-form';
import { PlusCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { ConfigurationFormSchema } from '@/schemas/configuration';
import { emptyInputRow } from '@/schemas/configuration';
import { InputRow } from './InputRow';

export interface InputOutputSectionProps {
  /** Which field array to manage. */
  prefix: 'inputs' | 'outputs';
  /** When true, each row exposes an add/remove list of variables. Defaults to false. */
  allowMultipleVariables?: boolean;
}

export function InputOutputSection({
  prefix,
  allowMultipleVariables = false,
}: InputOutputSectionProps) {
  const { control } = useFormContext<ConfigurationFormSchema>();
  const { fields, append, remove } = useFieldArray({ control, name: prefix });

  const sectionLabel = prefix === 'inputs' ? 'Inputs' : 'Outputs';

  return (
    <section aria-label={sectionLabel}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{sectionLabel}</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append(emptyInputRow(fields.length))}
          className="h-7 gap-1.5 text-xs"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          Add {sectionLabel === 'Inputs' ? 'Input' : 'Output'}
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="rounded-md border py-4 text-center text-sm text-muted-foreground">
          No {sectionLabel.toLowerCase()} defined. Click &ldquo;Add{' '}
          {sectionLabel === 'Inputs' ? 'Input' : 'Output'}&rdquo; to add one.
        </p>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <InputRow
              key={field.id}
              index={index}
              prefix={prefix}
              onRemove={() => remove(index)}
              allowMultipleVariables={allowMultipleVariables}
            />
          ))}
        </div>
      )}
    </section>
  );
}
