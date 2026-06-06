/**
 * InputRow — single row in the inputs or outputs field array.
 *
 * Fields: label, description, format, isOptional (junction field),
 * Standard Variable combobox, Unit combobox, collapsible variable overrides.
 *
 * isOptional is a first-class field — stored on the configuration_input junction row.
 */
import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import type { Path } from 'react-hook-form';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';

import { StandardVariableCombobox } from '@/components/autocomplete/StandardVariableCombobox';
import { UnitCombobox } from '@/components/autocomplete/UnitCombobox';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import type { ConfigurationFormSchema } from '@/schemas/configuration';
import { cn } from '@/lib/utils';

export interface InputRowProps {
  /** Index within the inputs or outputs array (for field array paths). */
  index: number;
  /** Field array prefix: "inputs" or "outputs". */
  prefix: 'inputs' | 'outputs';
  /** Called when the user removes this row. */
  onRemove: () => void;
}

export function InputRow({ index, prefix, onRemove }: InputRowProps) {
  const [overridesOpen, setOverridesOpen] = React.useState(false);
  const { control, register } = useFormContext<ConfigurationFormSchema>();

  // Cast to Path<ConfigurationFormSchema> — RHF's generic is too strict for
  // dynamic template literals, but the paths are always valid at runtime.
  const p = (field: string) =>
    `${prefix}.${index}.${field}` as Path<ConfigurationFormSchema>;

  return (
    <div className="rounded-md border p-4 space-y-3 bg-card">
      {/* Row header: position badge + remove button */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {prefix === 'inputs' ? 'Input' : 'Output'} {index + 1}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          aria-label={`Remove ${prefix === 'inputs' ? 'input' : 'output'} ${index + 1}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Label + Format row */}
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={control}
          name={p('label')}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Label *</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Precipitation" {...field} value={field.value as string ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={p('hasFormat')}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Format</FormLabel>
              <FormControl>
                <Input placeholder="e.g. CSV, NetCDF" {...field} value={field.value as string ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Description */}
      <FormField
        control={control}
        name={p('description')}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Input placeholder="Optional description" {...field} value={field.value as string ?? ''} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Standard Variable + Unit */}
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={control}
          name={p('standardVariable')}
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
          name={p('unit')}
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

      {/* isOptional */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={`${prefix}-${index}-isOptional`}
          className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
          {...register(p('isOptional'))}
        />
        <label
          htmlFor={`${prefix}-${index}-isOptional`}
          className="text-sm text-muted-foreground cursor-pointer select-none"
        >
          Optional (not required for model execution)
        </label>
      </div>

      {/* Collapsible variable overrides */}
      <div>
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setOverridesOpen((v) => !v)}
          aria-expanded={overridesOpen}
        >
          {overridesOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          Variable label overrides
        </button>

        {overridesOpen && (
          <div className={cn('grid grid-cols-3 gap-3 mt-2')}>
            <FormField
              control={control}
              name={p('variableLabel')}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Variable Label</FormLabel>
                  <FormControl>
                    <Input placeholder="Override label" {...field} value={field.value as string ?? ''} className="h-8 text-sm" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={p('variableLongName')}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Long Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Long name" {...field} value={field.value as string ?? ''} className="h-8 text-sm" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={p('variableShortName')}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Short Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Short name" {...field} value={field.value as string ?? ''} className="h-8 text-sm" />
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
