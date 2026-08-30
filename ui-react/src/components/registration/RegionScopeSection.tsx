/**
 * RegionScopeSection — the (non-optional) "Region" block of the Create-a-model
 * form, placed between Description and Parameters.
 *
 * Most models are non-spatial or work anywhere, so region selection is off by
 * default. Turning the switch on reveals a button that opens RegionPickerDialog
 * and shows the chosen regions as removable chips. Bound to CreateModelSchema.
 */
import * as React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { MapPin, Plus, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { RegionPickerDialog } from './RegionPickerDialog';
import type { CreateModelSchema } from '@/schemas/registration';

export function RegionScopeSection() {
  const { control, setValue } = useFormContext<CreateModelSchema>();
  const isRegionSpecific = useWatch<CreateModelSchema, 'isRegionSpecific'>({
    control,
    name: 'isRegionSpecific',
  });
  const regions = useWatch<CreateModelSchema, 'regions'>({ control, name: 'regions' }) ?? [];

  const [pickerOpen, setPickerOpen] = React.useState(false);

  const handleToggle = (next: boolean) => {
    setValue('isRegionSpecific', next, { shouldDirty: true });
    // Turning region scope off clears any picked regions so submit and the UI stay in sync.
    if (!next && regions.length > 0) {
      setValue('regions', [], { shouldDirty: true });
    }
  };

  const removeRegion = (id: string) => {
    setValue(
      'regions',
      regions.filter((r) => r.id !== id),
      { shouldDirty: true },
    );
  };

  return (
    <section aria-label="Region">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Region</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Most models work anywhere — turn this on only if the model is calibrated for, or its
            inputs are fixed to, specific geographic regions.
          </p>
        </div>
        <Switch
          checked={isRegionSpecific}
          onCheckedChange={handleToggle}
          aria-label="This model is region-specific"
        />
      </div>

      {isRegionSpecific && (
        <div className="mt-3 space-y-3">
          {regions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {regions.map((r) => (
                <Badge key={r.id} variant="secondary" className="gap-1 pr-1">
                  {r.label || r.id}
                  <button
                    type="button"
                    onClick={() => removeRegion(r.id)}
                    className="rounded-full p-0.5 hover:bg-muted"
                    aria-label={`Remove ${r.label || r.id}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPickerOpen(true)}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            {regions.length > 0 ? 'Edit regions' : 'Select regions'}
          </Button>
        </div>
      )}

      <RegionPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selected={regions}
        onChange={(next) => setValue('regions', next, { shouldDirty: true })}
      />
    </section>
  );
}
