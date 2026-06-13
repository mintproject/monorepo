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
import { Building2, Droplets, MapPin, Wheat, X } from 'lucide-react';

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
import { RegionSelectMap } from './RegionSelectMap';
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

  const categoryById = React.useMemo(() => {
    const map: Record<string, string> = {};
    (data?.region_category ?? []).forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, [data]);

  // `activeId` is the selected top-level category; `activeLevelId` is the actual
  // category queried — either the top category itself or one of its subcategory
  // levels (e.g. Administrative → Administrative Level 2).
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [activeLevelId, setActiveLevelId] = React.useState<string | null>(null);

  const selectTopCategory = (id: string) => {
    setActiveId(id);
    setActiveLevelId(id);
  };

  React.useEffect(() => {
    if (!open) return;
    if (topCategories.length === 0) return;
    const stillValid = topCategories.some((c) => c.id === activeId);
    if (!stillValid) {
      const first = topCategories[0]?.id ?? null;
      setActiveId(first);
      setActiveLevelId(first);
    }
  }, [open, topCategories, activeId]);

  const subLevels = activeId ? (subCategoryMap[activeId] ?? []) : [];

  const { data: regionData, loading: regionsLoading } = useQuery<{ region: PickerRegion[] }>(
    REGIONS_BY_CATEGORIES,
    {
      variables: { categoryIds: activeLevelId ? [activeLevelId] : [] },
      skip: !open || !activeLevelId,
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

  const selectedIds = React.useMemo(() => new Set(selected.map((r) => r.id)), [selected]);

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
                    onClick={() => selectTopCategory(cat.id)}
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

            {/* Level sub-tabs (e.g. Administrative / Level 2 / Level 3) */}
            {subLevels.length > 0 && activeId && (
              <div
                className="flex flex-wrap gap-1.5"
                role="tablist"
                aria-label={`${categoryById[activeId] ?? ''} levels`}
              >
                {[activeId, ...subLevels].map((levelId) => {
                  const active = levelId === activeLevelId;
                  return (
                    <button
                      key={levelId}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveLevelId(levelId)}
                      className={cn(
                        'rounded-md border px-2.5 py-1 text-xs transition-colors',
                        active
                          ? 'border-primary bg-primary/5 font-medium text-primary'
                          : 'border-transparent text-muted-foreground hover:bg-accent',
                      )}
                    >
                      {categoryById[levelId] ?? levelId}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Region map for the active category */}
            <div role="tabpanel">
              {regionsLoading ? (
                <div className="flex h-[320px] items-center justify-center rounded-md border bg-muted/30">
                  <LoadingSpinner size="sm" />
                </div>
              ) : regions.length === 0 ? (
                <p className="flex h-[320px] items-center justify-center rounded-md border bg-muted/30 text-center text-sm text-muted-foreground">
                  No regions in this category.
                </p>
              ) : (
                <RegionSelectMap regions={regions} selectedIds={selectedIds} onToggle={toggle} />
              )}
              <p className="mt-1.5 text-xs text-muted-foreground">
                Click a region on the map to select or deselect it.
              </p>
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
