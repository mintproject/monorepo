/**
 * VariablePresentationRow — one variable on an input/output.
 *
 * A presentation is the hub linking a dataset variable to its (optional) standard
 * variable and unit. An input can hold zero, one, or many of these.
 *
 * The VariablePresentation itself is hidden from the user. The row exposes a single
 * guided "standard variable & unit" picker (phenomenon → property → unit); the
 * presentation's label / long-name / short-name are derived on submit
 * (see mutation-builder), so the user never edits them directly.
 */
import { useFormContext } from 'react-hook-form';
import type { Path } from 'react-hook-form';
import { Trash2 } from 'lucide-react';

import { StandardVariableUnitPicker } from '@/components/autocomplete/StandardVariableUnitPicker';
import { Button } from '@/components/ui/button';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { ConfigurationFormSchema } from '@/schemas/configuration';

export interface VariablePresentationRowProps {
  /** Field path prefix for this presentation, e.g. "inputs.0.presentations.1". */
  basePath: string;
  /** Display index (1-based) shown in the header. */
  index: number;
  /** When provided, renders a remove button. Omit to make the row non-removable. */
  onRemove?: () => void;
}

export function VariablePresentationRow({
  basePath,
  index,
  onRemove,
}: VariablePresentationRowProps) {
  const { control, watch, setValue } = useFormContext<ConfigurationFormSchema>();

  // RHF's generic is too strict for dynamic template-literal paths, but they are
  // always valid at runtime.
  const f = (field: string) => `${basePath}.${field}` as Path<ConfigurationFormSchema>;

  return (
    <div className="space-y-3 rounded-md border bg-background p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Variable {index}
        </span>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            aria-label={`Remove variable ${index}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Standard variable + Unit — single guided picker (the VariablePresentation
          concept is hidden; label/long/short are derived on submit). */}
      <FormField
        control={control}
        name={f('standardVariable')}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Standard variable &amp; unit</FormLabel>
            <FormControl>
              <StandardVariableUnitPicker
                variable={
                  field.value as Parameters<typeof StandardVariableUnitPicker>[0]['variable']
                }
                unit={watch(f('unit')) as Parameters<typeof StandardVariableUnitPicker>[0]['unit']}
                onResolve={(variable, unit) => {
                  field.onChange(variable);
                  setValue(f('unit'), unit as Parameters<typeof setValue>[1], {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
