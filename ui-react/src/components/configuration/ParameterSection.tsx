/**
 * ParameterSection — field array section for model configuration parameters.
 */
import { useFieldArray, useFormContext } from 'react-hook-form';
import { PlusCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { ConfigurationFormSchema } from '@/schemas/configuration';
import { emptyParameterRow } from '@/schemas/configuration';
import { ParameterRow } from './ParameterRow';

export function ParameterSection() {
  const { control } = useFormContext<ConfigurationFormSchema>();
  const { fields, append, remove } = useFieldArray({ control, name: 'parameters' });

  return (
    <section aria-label="Parameters">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Parameters</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append(emptyParameterRow(fields.length))}
          className="h-7 gap-1.5 text-xs"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          Add Parameter
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="rounded-md border py-4 text-center text-sm text-muted-foreground">
          No parameters defined. Click &ldquo;Add Parameter&rdquo; to add one.
        </p>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <ParameterRow key={field.id} index={index} onRemove={() => remove(index)} />
          ))}
        </div>
      )}
    </section>
  );
}
