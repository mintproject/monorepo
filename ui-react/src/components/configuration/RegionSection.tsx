/**
 * RegionSection — multi-select existing regions for a configuration.
 *
 * Loads all regions from Hasura and lets the user toggle selections.
 * Selections are stored in the form as an array of { id, label }.
 */
import * as React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Check, X } from 'lucide-react';

import { useGetRegionsQuery } from '@/graphql/generated/graphql';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import type { ConfigurationFormSchema } from '@/schemas/configuration';
import { cn } from '@/lib/utils';

export function RegionSection() {
  const { setValue } = useFormContext<ConfigurationFormSchema>();
  const selectedRegions = useWatch<ConfigurationFormSchema, 'regions'>({ name: 'regions' });

  const { data, loading, error } = useGetRegionsQuery({ fetchPolicy: 'cache-first' });

  const regions = React.useMemo(() => data?.modelcatalog_region ?? [], [data]);

  const isSelected = (id: string) => selectedRegions?.some((r) => r.id === id) ?? false;

  const toggleRegion = React.useCallback(
    (id: string, label: string) => {
      const current = selectedRegions ?? [];
      if (isSelected(id)) {
        setValue(
          'regions',
          current.filter((r) => r.id !== id),
          { shouldDirty: true },
        );
      } else {
        setValue('regions', [...current, { id, label }], { shouldDirty: true });
      }
    },
    [selectedRegions, setValue],
  );

  const removeRegion = (id: string) => {
    setValue(
      'regions',
      (selectedRegions ?? []).filter((r) => r.id !== id),
      { shouldDirty: true },
    );
  };

  if (loading) {
    return (
      <section aria-label="Regions">
        <h3 className="mb-3 text-sm font-semibold">Regions</h3>
        <LoadingSpinner size="sm" />
      </section>
    );
  }

  if (error) {
    return (
      <section aria-label="Regions">
        <h3 className="mb-3 text-sm font-semibold">Regions</h3>
        <p className="text-sm text-destructive">Failed to load regions.</p>
      </section>
    );
  }

  return (
    <section aria-label="Regions">
      <h3 className="mb-3 text-sm font-semibold">Regions</h3>

      {/* Selected chips */}
      {(selectedRegions?.length ?? 0) > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {selectedRegions?.map((r) => (
            <Badge key={r.id} variant="secondary" className="gap-1 pr-1">
              {r.label || r.id}
              <button
                type="button"
                onClick={() => removeRegion(r.id)}
                className="rounded-full p-0.5 hover:bg-muted"
                aria-label={`Remove region ${r.label}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Available regions list */}
      <div className="max-h-40 overflow-y-auto rounded-md border">
        {regions.length === 0 ? (
          <p className="p-3 text-center text-sm text-muted-foreground">No regions available.</p>
        ) : (
          <ul>
            {regions.map((region) => {
              const selected = isSelected(region.id);
              return (
                <li key={region.id}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                      selected && 'bg-accent/50',
                    )}
                    onClick={() => toggleRegion(region.id, region.label ?? '')}
                    aria-pressed={selected}
                  >
                    <Check
                      className={cn('h-3.5 w-3.5 shrink-0', selected ? 'opacity-100' : 'opacity-0')}
                    />
                    <span className="truncate">{region.label || region.id}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
