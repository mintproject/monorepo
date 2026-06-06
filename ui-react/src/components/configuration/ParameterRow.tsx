/**
 * ParameterRow — single row in the parameters field array.
 *
 * Fields: label, data type, default value, min, max, accepted values, fixed value.
 */
import { useFormContext } from 'react-hook-form';
import type { Path } from 'react-hook-form';
import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import type { ConfigurationFormSchema } from '@/schemas/configuration';

const DATA_TYPES = ['string', 'integer', 'float', 'boolean', 'url', 'datetime'];

export interface ParameterRowProps {
  index: number;
  onRemove: () => void;
}

export function ParameterRow({ index, onRemove }: ParameterRowProps) {
  const { control } = useFormContext<ConfigurationFormSchema>();

  // Cast to Path<ConfigurationFormSchema> — RHF generic is too strict for
  // dynamic template literals, but the paths are always valid at runtime.
  const p = (field: string) => `parameters.${index}.${field}` as Path<ConfigurationFormSchema>;

  return (
    <div className="space-y-3 rounded-md border bg-card p-4">
      {/* Row header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Parameter {index + 1}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          aria-label={`Remove parameter ${index + 1}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Label + Data type */}
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={control}
          name={p('label')}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Label *</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. Threshold"
                  {...field}
                  value={(field.value as string) ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={p('hasDataType')}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Data Type</FormLabel>
              <FormControl>
                <select
                  className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={(field.value as string) ?? ''}
                  onChange={(e) => field.onChange(e.target.value || undefined)}
                >
                  <option value="">Select type</option>
                  {DATA_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
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
              <Input
                placeholder="Optional description"
                {...field}
                value={(field.value as string) ?? ''}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Default + Fixed value */}
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={control}
          name={p('hasDefaultValue')}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Default Value</FormLabel>
              <FormControl>
                <Input placeholder="Default" {...field} value={(field.value as string) ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={p('hasFixedValue')}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fixed Value</FormLabel>
              <FormControl>
                <Input
                  placeholder="Fixed (overrides default)"
                  {...field}
                  value={(field.value as string) ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Min + Max */}
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={control}
          name={p('hasMinimumAcceptedValue')}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Min Value</FormLabel>
              <FormControl>
                <Input placeholder="Minimum" {...field} value={(field.value as string) ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={p('hasMaximumAcceptedValue')}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Max Value</FormLabel>
              <FormControl>
                <Input placeholder="Maximum" {...field} value={(field.value as string) ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
