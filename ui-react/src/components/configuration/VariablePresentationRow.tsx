/**
 * VariablePresentationRow — one variable presentation on an input/output.
 *
 * A presentation is the hub linking a dataset variable to its (optional) standard
 * variable and unit. An input can hold zero, one, or many of these.
 *
 * Fields: Name (label, headline), Standard Variable, Unit, and collapsible
 * long-name / short-name overrides. The Name may be left blank — on submit it is
 * derived from the selected standard variable (see mutation-builder).
 */
import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import type { Path } from 'react-hook-form';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';

import { StandardVariableCombobox } from '@/components/autocomplete/StandardVariableCombobox';
import { UnitCombobox } from '@/components/autocomplete/UnitCombobox';
import { Button } from '@/components/ui/button';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
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
  const [overridesOpen, setOverridesOpen] = React.useState(false);
  const { control } = useFormContext<ConfigurationFormSchema>();

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

      {/* Name (presentation label) */}
      <FormField
        control={control}
        name={f('variableLabel')}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g. PREC (defaults to the standard variable)"
                {...field}
                value={(field.value as string) ?? ''}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Standard Variable + Unit */}
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={control}
          name={f('standardVariable')}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Standard Variable</FormLabel>
              <FormControl>
                <StandardVariableCombobox
                  value={field.value as Parameters<typeof StandardVariableCombobox>[0]['value']}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={f('unit')}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Unit</FormLabel>
              <FormControl>
                <UnitCombobox
                  value={field.value as Parameters<typeof UnitCombobox>[0]['value']}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Collapsible long/short name overrides */}
      <div>
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setOverridesOpen((v) => !v)}
          aria-expanded={overridesOpen}
        >
          {overridesOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          Long name / short name
        </button>

        {overridesOpen && (
          <div className="mt-2 grid grid-cols-2 gap-3">
            <FormField
              control={control}
              name={f('variableLongName')}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Long Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Long name"
                      {...field}
                      value={(field.value as string) ?? ''}
                      className="h-8 text-sm"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={f('variableShortName')}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Short Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Short name"
                      {...field}
                      value={(field.value as string) ?? ''}
                      className="h-8 text-sm"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
}
