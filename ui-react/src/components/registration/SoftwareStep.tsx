/**
 * SoftwareStep — Step 1 of the ModelRegistrationWizard.
 *
 * Collects Software entity metadata:
 * label, description, keywords, license, website, type
 *
 * See: .planning/design/DESIGN-DOCUMENT.md §5.6
 */
import { useFormContext } from 'react-hook-form';

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SOFTWARE_TYPE_MODEL, SOFTWARE_TYPE_EMULATOR } from '@/schemas/registration';
import type { SoftwareStepSchema } from '@/schemas/registration';

const SOFTWARE_TYPES = [
  { value: SOFTWARE_TYPE_MODEL, label: 'Model' },
  { value: SOFTWARE_TYPE_EMULATOR, label: 'Emulator' },
];

export function SoftwareStep() {
  const { control } = useFormContext<SoftwareStepSchema>();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Provide basic information about the model software.
      </p>

      {/* Label */}
      <FormField
        control={control}
        name="label"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Model Name <span className="text-destructive">*</span>
            </FormLabel>
            <FormControl>
              <Input placeholder="e.g. PIHM, TOPMODEL" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Type */}
      <FormField
        control={control}
        name="type"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Type <span className="text-destructive">*</span>
            </FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {SOFTWARE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Description */}
      <FormField
        control={control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea placeholder="Brief description of the model" rows={3} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Keywords */}
      <FormField
        control={control}
        name="keywords"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Keywords</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g. hydrology, rainfall, watershed (comma-separated)"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* License */}
      <FormField
        control={control}
        name="license"
        render={({ field }) => (
          <FormItem>
            <FormLabel>License</FormLabel>
            <FormControl>
              <Input placeholder="e.g. MIT, Apache 2.0, GPL-3.0" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Website */}
      <FormField
        control={control}
        name="website"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Website</FormLabel>
            <FormControl>
              <Input placeholder="https://example.com/model" type="url" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
