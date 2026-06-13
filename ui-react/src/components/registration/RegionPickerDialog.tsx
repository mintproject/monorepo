/**
 * RegionPickerDialog — choose the geographic regions a model is calibrated for.
 *
 * Reads the geographic `region` table grouped by the three top-level categories
 * (Agricultural / Hydrological / Administrative, plus their subcategories) and
 * returns selections as { id, label } where id is the geographic region id. The
 * caller mirrors these into `modelcatalog_region` on save.
 */
import * as React from 'react';
import { useQuery } from '@apollo/client';
import { Building2, Check, Droplets, MapPin, Wheat, X } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useListRegionCategoriesQuery } from '@/graphql/generated/graphql';
import { REGIONS_BY_CATEGORIES, type PickerRegion } from '@/graphql/region-picker';
import type { RegionSelection } from '@/lib/mutation-builder';
import { cn } from '@/lib/utils';

interface CategoryMeta {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** Display decoration for the known top-level categories, keyed by category id. */
const CATEGORY_META: Record<string, CategoryMeta> = {
  agriculture: { label: 'Agricultural Regions', icon: Wheat },
  hydrology: { label: 'Hydrological Regions', icon: Droplets },
  administrative: { label: 'Administrative Regions', icon: Building2 },
};
const CATEGORY_ORDER = ['agriculture', 'hydrology', 'administrative'];

interface RegionPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: RegionSelection[];
  onChange: (next: RegionSelection[]) => void;
}

export function RegionPickerDialog({
  open,
  onOpenChange,
  selected,
  onChange,
}: RegionPickerDialogProps) {
  const { data, loading: catsLoading } = useListRegionCategoriesQuery({ skip: !open });

  const topCategories = React.useMemo(() => {
    const cats = data?.region_category ?? [];
    const subIds = new Set<string>();
    cats.forEach((c) => c.sub_categories.forEach((s) => subIds.add(s.region_category_id)));
    const tops = cats.filter((c) => !subIds.has(c.id));
    return tops.sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a.id);
      const ib = CATEGORY_ORDER.indexOf(b.id);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [data]);

  const subCategoryMap = React.useMemo(() => {
    const map: Record<string, string[]> = {};
    (data?.region_category ?? []).forEach((c) => {
      map[c.id] = c.sub_categories.map((s) => s.region_category_id);
    });
    return map;
  }, [data]);

  const [activeId, setActiveId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    if (topCategories.length === 0) return;
    const stillValid = topCategories.some((c) => c.id === activeId);
    if (!stillValid) setActiveId(topCategories[0]?.id ?? null);
  }, [open, topCategories, activeId]);

  const activeCategoryIds = React.useMemo(
    () => (activeId ? [activeId, ...(subCategoryMap[activeId] ?? [])] : []),
    [activeId, subCategoryMap],
  );

  const { data: regionData, loading: regionsLoading } = useQuery<{ region: PickerRegion[] }>(
    REGIONS_BY_CATEGORIES,
    {
      variables: { categoryIds: activeCategoryIds },
      skip: !open || activeCategoryIds.length === 0,
      fetchPolicy: 'cache-first',
    },
  );
  const regions = regionData?.region ?? [];

  const isSelected = (id: string) => selected.some((r) => r.id === id);

  const toggle = (region: PickerRegion) => {
    if (isSelected(region.id)) {
      onChange(selected.filter((r) => r.id !== region.id));
    } else {
      onChange([...selected, { id: region.id, label: region.name }]);
    }
  };

  const remove = (id: string) => onChange(selected.filter((r) => r.id !== id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Select regions
          </DialogTitle>
          <DialogDescription>
            Pick the geographic regions this model is calibrated for. Browse by category.
          </DialogDescription>
        </DialogHeader>

        {/* Selected chips */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((r) => (
              <Badge key={r.id} variant="secondary" className="gap-1 pr-1">
                {r.label || r.id}
                <button
                  type="button"
                  onClick={() => remove(r.id)}
                  className="rounded-full p-0.5 hover:bg-muted"
                  aria-label={`Remove ${r.label || r.id}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Category tabs */}
        {catsLoading ? (
          <LoadingSpinner size="sm" />
        ) : topCategories.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No regions available.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Region categories">
              {topCategories.map((cat) => {
                const meta = CATEGORY_META[cat.id];
                const Icon = meta?.icon ?? MapPin;
                const active = cat.id === activeId;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveId(cat.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-muted text-muted-foreground hover:bg-accent',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {meta?.label ?? cat.name}
                  </button>
                );
              })}
            </div>

            {/* Region list for the active category */}
            <div className="max-h-64 overflow-y-auto rounded-md border" role="tabpanel">
              {regionsLoading ? (
                <div className="p-4">
                  <LoadingSpinner size="sm" />
                </div>
              ) : regions.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  No regions in this category.
                </p>
              ) : (
                <ul>
                  {regions.map((region) => {
                    const sel = isSelected(region.id);
                    return (
                      <li key={region.id}>
                        <button
                          type="button"
                          onClick={() => toggle(region)}
                          aria-pressed={sel}
                          className={cn(
                            'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                            sel && 'bg-accent/50',
                          )}
                        >
                          <Check
                            className={cn(
                              'h-3.5 w-3.5 shrink-0 text-primary',
                              sel ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                          <span className="truncate">{region.name}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
