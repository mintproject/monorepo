/**
 * ConfigurationStep — Step 3 of the ModelRegistrationWizard.
 *
 * Collects ModelConfiguration metadata (label, description, inputs, outputs,
 * parameters) using the flattened form components.
 *
 * This step operates within its own FormProvider using ConfigurationFormSchema.
 * The wizard reads the form data at submit time via configForm.getValues().
 *
 * See: .planning/design/DESIGN-DOCUMENT.md §5.6
 */
import { useFormContext } from 'react-hook-form';

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { InputOutputSection } from '@/components/configuration/InputOutputSection';
import { ParameterSection } from '@/components/configuration/ParameterSection';
import type { ConfigurationFormSchema } from '@/schemas/configuration';

export function ConfigurationStep() {
  const { control } = useFormContext<ConfigurationFormSchema>();

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Define the configuration for this model version — its name, inputs, outputs, and parameters.
      </p>

      {/* Configuration metadata */}
      <div className="space-y-4">
        <FormField
          control={control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Configuration Name <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input placeholder="e.g. Default configuration" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Brief description of this configuration"
                  rows={2}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <Separator />

      {/* Reuse the same section components as ConfigurationForm */}
      <InputOutputSection prefix="inputs" />

      <Separator />

      <InputOutputSection prefix="outputs" />

      <Separator />

      <ParameterSection />
    </div>
  );
}
