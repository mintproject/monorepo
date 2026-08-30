/**
 * ModelsBrowsePage — the model find/configure experience.
 *
 * Left column: text search + facet filters (Region / Category / Output
 * variable) over a server-side-filtered, client-grouped Model -> Config -> Setup
 * list. Right column: detail for the config/setup in the URL. The URL is the
 * source of truth for facet filters and selection; the text search is
 * local-only and never touches it.
 *
 * Mounted at two routes that share the same left panel:
 *   - /models + /modelconfigurations/:slugid — read-only browse.
 *   - /models/configure/:slugid (editable)   — same panel, but the detail pane
 *     exposes an Edit button that opens the inline ConfigurationForm.
 */
import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';

import { useSearchModelConfigurationsQuery } from '@/graphql/generated/graphql';
import { groupConfigurations } from '@/lib/groupConfigurations';
import {
  buildConfigurationWhere,
  filtersToParams,
  hasActiveFilters,
  parseFilters,
  type ModelBrowseFilters,
} from '@/lib/modelBrowseFilters';
import { slugMatchPattern } from '@/lib/uri';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfigurationDetail } from '@/components/configuration/ConfigurationDetail';
import { ConfigurationForm } from '@/components/configuration/ConfigurationForm';
import { FacetSelect } from './FacetSelect';
import { ModelGroupList } from './ModelGroupList';
import { useFacetOptions } from './useFacetOptions';
import { useGetConfigurationBySlugQuery } from '@/graphql/generated/graphql';

export interface ModelsBrowsePageProps {
  /** When true, the detail pane allows editing the selected configuration. */
  editable?: boolean;
  /** Route prefix for left-panel row links (the slug is appended). */
  basePath?: string;
}

export function ModelsBrowsePage({
  editable = false,
  basePath = '/modelconfigurations',
}: ModelsBrowsePageProps = {}) {
  const { slugid } = useParams<{ slugid: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  // Drop any `q` from the URL — text search is intentionally not URL-driven.
  const facetFilters = useMemo(() => ({ ...parseFilters(searchParams), q: '' }), [searchParams]);

  // Text search is local-only — it filters results but never touches the URL.
  // Only the facets (Region / Category / Output variable) live in the URL.
  const [text, setText] = useState('');
  const debouncedText = useDebouncedValue(text, 300);

  const filters = useMemo(
    () => ({ ...facetFilters, q: debouncedText }),
    [facetFilters, debouncedText],
  );

  const updateFacet = (partial: Partial<ModelBrowseFilters>) => {
    setSearchParams(filtersToParams({ ...facetFilters, ...partial }));
  };

  const facetOptions = useFacetOptions();
  const where = useMemo(() => buildConfigurationWhere(filters), [filters]);
  const { data, loading, error } = useSearchModelConfigurationsQuery({ variables: { where } });

  const groups = useMemo(() => groupConfigurations(data?.modelcatalog_configuration ?? []), [data]);
  const active = hasActiveFilters(filters);

  return (
    <div className="flex h-full overflow-hidden">
      <aside className="flex w-96 shrink-0 flex-col border-r">
        <div className="flex flex-col gap-2 border-b p-3">
          <h2 className="text-base font-semibold">Models</h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Filter by model name…"
              className="h-9 pl-8"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <FacetSelect
              label="Region"
              options={facetOptions.regions}
              selectedIds={filters.regionIds}
              onChange={(ids) => updateFacet({ regionIds: ids })}
              loading={facetOptions.loading}
            />
            <FacetSelect
              label="Category"
              options={facetOptions.categories}
              selectedIds={filters.categoryIds}
              onChange={(ids) => updateFacet({ categoryIds: ids })}
              loading={facetOptions.loading}
            />
            <FacetSelect
              label="Output variable"
              options={facetOptions.variables}
              selectedIds={filters.variableIds}
              onChange={(ids) => updateFacet({ variableIds: ids })}
              loading={facetOptions.loading}
            />
          </div>
        </div>
        <div className="flex-1 overflow-auto p-2">
          {loading ? (
            <ListSkeleton />
          ) : error ? (
            <p className="px-1 py-8 text-center text-sm text-destructive">{error.message}</p>
          ) : (
            <ModelGroupList
              groups={groups}
              selectedSlug={slugid ?? null}
              expandAll={active}
              basePath={basePath}
            />
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-6">
        <DetailPane slug={slugid} editable={editable} />
      </main>
    </div>
  );
}

function DetailPane({ slug, editable }: { slug?: string; editable: boolean }) {
  const { data, loading } = useGetConfigurationBySlugQuery({
    variables: { pattern: slug ? slugMatchPattern(slug) : '' },
    skip: !slug,
  });

  if (!slug) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Select a configuration or setup on the left.
      </div>
    );
  }
  if (loading) {
    return <ListSkeleton />;
  }
  const id = data?.modelcatalog_configuration?.[0]?.id;
  if (!id) {
    return <p className="text-sm text-destructive">Configuration not found.</p>;
  }
  return editable ? (
    <EditableDetail key={id} configurationId={id} />
  ) : (
    <ConfigurationDetail configurationId={id} />
  );
}

/**
 * Read-only detail first, with an Edit button that opens the inline form.
 * Keyed by configurationId so switching selection resets edit state.
 */
function EditableDetail({ configurationId }: { configurationId: string }) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <ConfigurationForm
        configurationId={configurationId}
        onSaved={() => setIsEditing(false)}
        onCancel={() => setIsEditing(false)}
      />
    );
  }
  return (
    <ConfigurationDetail configurationId={configurationId} onEdit={() => setIsEditing(true)} />
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2 p-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-6 w-full" />
      ))}
    </div>
  );
}
