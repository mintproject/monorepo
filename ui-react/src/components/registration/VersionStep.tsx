/**
 * VersionStep — Step 2 of the ModelRegistrationWizard.
 *
 * Collects SoftwareVersion entity metadata:
 * versionId, label, description, hasUsageNotes, hasSourceCode
 *
 * See: .planning/design/DESIGN-DOCUMENT.md §5.6
 */
import { useFormContext } from 'react-hook-form';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { VersionStepSchema } from '@/schemas/registration';

export function VersionStep() {
  const { control } = useFormContext<VersionStepSchema>();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Specify version information for this release of the model.
      </p>

      {/* Version ID */}
      <FormField
        control={control}
        name="versionId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Version ID</FormLabel>
            <FormControl>
              <Input placeholder="e.g. v2.1.0, 2024-03, r5" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Label */}
      <FormField
        control={control}
        name="label"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Version Label <span className="text-destructive">*</span>
            </FormLabel>
            <FormControl>
              <Input placeholder="e.g. PIHM v2.1 — Spring 2024 release" {...field} />
            </FormControl>
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
              <Textarea
                placeholder="What changed in this version?"
                rows={3}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Usage notes */}
      <FormField
        control={control}
        name="hasUsageNotes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Usage Notes</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Instructions for running or configuring this version"
                rows={3}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Source code */}
      <FormField
        control={control}
        name="hasSourceCode"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Source Code URL</FormLabel>
            <FormControl>
              <Input
                placeholder="https://github.com/org/model"
                type="url"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
