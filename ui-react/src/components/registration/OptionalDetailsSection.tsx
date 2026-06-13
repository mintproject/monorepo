/**
 * OptionalDetailsSection — the single "Optional details" block at the bottom of
 * the Create-a-model form: Model Family link, License, Website, Keywords.
 * Everything here is optional. Bound to CreateModelSchema via form context.
 * (Region selection has its own non-optional section — see RegionScopeSection.)
 */
import { Controller, useFormContext } from 'react-hook-form';

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ModelFamilyPicker } from './ModelFamilyPicker';
import type { CreateModelSchema } from '@/schemas/registration';

export function OptionalDetailsSection() {
  const { control } = useFormContext<CreateModelSchema>();

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
