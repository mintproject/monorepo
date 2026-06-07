/**
 * OptionalDetailsSection — the single "Optional details" block at the bottom of
 * the Create-a-model form: Model Family link, Region(s), License, Website, Keywords.
 * Everything here is optional. Bound to CreateModelSchema via form context.
 */
import { Controller, useFormContext } from 'react-hook-form';

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useGetRegionsQuery } from '@/graphql/generated/graphql';
import { ModelFamilyPicker } from './ModelFamilyPicker';
import type { CreateModelSchema } from '@/schemas/registration';

export function OptionalDetailsSection() {
  const { control, watch, setValue } = useFormContext<CreateModelSchema>();
  const { data: regionData } = useGetRegionsQuery({ fetchPolicy: 'cache-first' });
  const regions = regionData?.modelcatalog_region ?? [];
  const selectedRegions = watch('regions');

  const toggleRegion = (id: string, label: string) => {
    const exists = selectedRegions.some((r) => r.id === id);
    setValue(
      'regions',
      exists ? selectedRegions.filter((r) => r.id !== id) : [...selectedRegions, { id, label }],
      { shouldDirty: true },
    );
  };

  return (
    <section className="rounded-lg border bg-muted/20 p-4">
      <div className="mb-1 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">Optional details</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          all optional
        </span>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Skip any of these — you can fill them in later from the model page.
      </p>

      {/* Model Family */}
      <div className="space-y-2">
        <Label>Model Family</Label>
        <Controller
          control={control}
          name="modelFamily"
          render={({ field }) => (
            <ModelFamilyPicker value={field.value} onChange={field.onChange} />
          )}
        />
      </div>

      <Separator className="my-4" />

      {/* Regions */}
      <div className="space-y-2">
        <Label>Region</Label>
        {regions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No regions available.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {regions.map((r) => {
              const active = selectedRegions.some((s) => s.id === r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggleRegion(r.id, r.label ?? '')}
                  className={[
                    'rounded-full border px-3 py-1 text-xs',
                    active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-muted text-muted-foreground',
                  ].join(' ')}
                  aria-pressed={active}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Separator className="my-4" />

      {/* License / Website / Keywords */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          control={control}
          name="license"
          render={({ field }) => (
            <FormItem>
              <FormLabel>License</FormLabel>
              <FormControl>
                <Input placeholder="e.g. MIT, Apache 2.0" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="website"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Website</FormLabel>
              <FormControl>
                <Input type="url" placeholder="https://example.com/model" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={control}
        name="keywords"
        render={({ field }) => (
          <FormItem className="mt-4">
            <FormLabel>Keywords</FormLabel>
            <FormControl>
              <Input placeholder="e.g. groundwater, karst (comma-separated)" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </section>
  );
}
