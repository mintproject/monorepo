import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, SlidersHorizontal } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useGetModelTreeWithRegionsQuery, extractModelIO } from '@/graphql/generated/modeling';
import { searchDatasets } from '@/lib/datasets/data-catalog-api';
import { discoverDatasets } from '@/lib/datasets/discovery';
import { canonicalStandardVariable } from '@/lib/datasets/ckan';
import type { DatasetDiscoveryResult } from '@/lib/datasets/types';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

import { DatasetCompatibilityPanel } from './DatasetCompatibilityPanel';

type Mode = 'browse' | 'model';
type CoverageFilter = 'all' | 'known' | 'unknown';

interface ModelOption {
  id: string;
  label: string;
  family: string;
  inputs: Array<{
    ids: string[];
    labels: string[];
    optional: boolean;
  }>;
  requiredCount: number;
}

function flattenModelOptions(
  data: ReturnType<typeof useGetModelTreeWithRegionsQuery>['data'],
): ModelOption[] {
  if (!data) return [];
  return data.modelcatalog_software.flatMap((software) =>
    software.versions.flatMap((version) =>
      version.configurations.flatMap((config) => {
        const configs =
          config.child_configurations.length > 0 ? config.child_configurations : [config];
        return configs.map((candidate) => {
          const io = extractModelIO(candidate);
          const inputs = io.inputs;
          return {
            id: candidate.id,
            label: candidate.label ?? candidate.id,
            family: software.label ?? software.id,
            inputs: inputs.map((input) => ({
              ids: input.variableIds,
              labels: input.variableLabels,
              optional: input.optional,
            })),
            requiredCount: inputs.filter((input) => !input.optional).length,
          };
        });
      }),
    ),
  );
}

function overlapsYear(
  dataset: DatasetDiscoveryResult,
  startYear: number,
  endYear: number,
): boolean {
  const period = dataset.time_period;
  if (!period) return true;
  const start = period.start_date?.getFullYear();
  const end = period.end_date?.getFullYear();
  if (start !== undefined && start > endYear) return false;
  if (end !== undefined && end < startYear) return false;
  return true;
}

function datasetMatchesModel(dataset: DatasetDiscoveryResult, model: ModelOption): number {
  const variables = new Set(dataset.variables.map(canonicalStandardVariable));
  return model.inputs.filter((input) =>
    [...input.ids, ...input.labels].some((value) =>
      variables.has(canonicalStandardVariable(value)),
    ),
  ).length;
}

export function DatasetDiscovery() {
  const [mode, setMode] = useState<Mode>('browse');
  const [query, setQuery] = useState('');
  const [coverage, setCoverage] = useState<CoverageFilter>('all');
  const [startYear, setStartYear] = useState(1900);
  const [endYear, setEndYear] = useState(2030);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [datasets, setDatasets] = useState<DatasetDiscoveryResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [semanticFallback, setSemanticFallback] = useState(false);
  const [panelDataset, setPanelDataset] = useState<DatasetDiscoveryResult | null>(null);
  const debouncedQuery = useDebouncedValue(query, 300);

  const { data: modelData } = useGetModelTreeWithRegionsQuery({ skip: mode !== 'model' });
  const models = useMemo(() => flattenModelOptions(modelData), [modelData]);
  const selectedModel = models.find((model) => model.id === selectedModelId);

  useEffect(() => {
    if (!selectedModelId && models[0]) setSelectedModelId(models[0].id);
  }, [models, selectedModelId]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    setSemanticFallback(false);

    const load = async () => {
      try {
        if (debouncedQuery.trim()) {
          const result = await discoverDatasets({
            query: debouncedQuery,
            signal: controller.signal,
          });
          if (active) setDatasets(result.datasets);
        } else {
          const result = await searchDatasets({});
          if (active) {
            setDatasets(
              result
                .filter((dataset) => dataset.variables.length > 0)
                .map((dataset) => ({ ...dataset, matched_variables: dataset.variables })),
            );
          }
        }
      } catch (reason) {
        if (!active || controller.signal.aborted) return;
        if (debouncedQuery.trim()) {
          try {
            const fallback = await searchDatasets({ name: `*${debouncedQuery.trim()}*` });
            if (active) {
              setDatasets(
                fallback
                  .filter((dataset) => dataset.variables.length > 0)
                  .map((dataset) => ({ ...dataset, matched_variables: dataset.variables })),
              );
              setSemanticFallback(true);
            }
          } catch (fallbackReason) {
            if (active)
              setError(
                fallbackReason instanceof Error ? fallbackReason.message : 'Dataset search failed',
              );
          }
        } else if (active) {
          setError(reason instanceof Error ? reason.message : 'Dataset search failed');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [debouncedQuery]);

  const visibleDatasets = useMemo(() => {
    let result = datasets.filter((dataset) => overlapsYear(dataset, startYear, endYear));
    if (coverage === 'known')
      result = result.filter((dataset) => Boolean(dataset.spatial_coverage));
    if (coverage === 'unknown') result = result.filter((dataset) => !dataset.spatial_coverage);
    if (selectedModel) {
      result = result
        .map((dataset) => ({
          ...dataset,
          modelMatchCount: datasetMatchesModel(dataset, selectedModel),
        }))
        .filter((dataset) => dataset.modelMatchCount > 0)
        .sort((a, b) => b.modelMatchCount - a.modelMatchCount || a.name.localeCompare(b.name));
    }
    return result;
  }, [coverage, datasets, endYear, selectedModel, startYear]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Datasets</h2>
        <p className="mt-1 text-muted-foreground">
          Find MINT-ready datasets by scientific meaning, coverage, and model compatibility.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Dataset discovery mode">
        <Button
          variant={mode === 'browse' ? 'default' : 'outline'}
          onClick={() => setMode('browse')}
          role="tab"
          aria-selected={mode === 'browse'}
        >
          Browse MINT-ready datasets
        </Button>
        <Button
          variant={mode === 'model' ? 'default' : 'outline'}
          onClick={() => setMode('model')}
          role="tab"
          aria-selected={mode === 'model'}
        >
          Find data for a model
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4" /> Search and filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try “rainfall for the Edwards Aquifer”"
                className="pl-9"
                aria-label="Search MINT datasets"
              />
            </div>
            <Button variant="outline" onClick={() => setQuery('')}>
              Clear
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Region / spatial coverage</span>
              <select
                value={coverage}
                onChange={(event) => setCoverage(event.target.value as CoverageFilter)}
                className="h-10 w-full rounded-md border border-input bg-background px-3"
              >
                <option value="all">Any coverage</option>
                <option value="known">Has spatial coverage</option>
                <option value="unknown">Spatial coverage unknown</option>
              </select>
            </label>
            <div className="space-y-2 text-sm">
              <span className="font-medium">Temporal coverage</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1900"
                  max="2030"
                  value={startYear}
                  onChange={(event) => setStartYear(Math.min(Number(event.target.value), endYear))}
                  aria-label="Temporal coverage start year"
                  className="w-full"
                />
                <span className="w-10 text-right text-xs text-muted-foreground">{startYear}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1900"
                  max="2030"
                  value={endYear}
                  onChange={(event) => setEndYear(Math.max(Number(event.target.value), startYear))}
                  aria-label="Temporal coverage end year"
                  className="w-full"
                />
                <span className="w-10 text-right text-xs text-muted-foreground">{endYear}</span>
              </div>
            </div>
            {mode === 'model' ? (
              <label className="space-y-1 text-sm">
                <span className="font-medium">Model / configuration</span>
                <select
                  value={selectedModelId}
                  onChange={(event) => setSelectedModelId(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3"
                  aria-label="Select model"
                >
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label} · {model.family}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <SlidersHorizontal className="h-4 w-4" /> Semantic search resolves to SVOs before
                dataset matching.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {semanticFallback && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Semantic search was unavailable, so these results use dataset title matching. Try an
          explicit SVO name for precise matching.
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {loading
            ? 'Searching…'
            : `${visibleDatasets.length} MINT-ready dataset${visibleDatasets.length === 1 ? '' : 's'}`}
        </p>
        {selectedModel && (
          <Badge variant="outline">
            Model mode · {selectedModel.requiredCount} required inputs
          </Badge>
        )}
      </div>

      <div className="space-y-3">
        {!loading &&
          visibleDatasets.map((dataset) => {
            const modelCount = selectedModel
              ? datasetMatchesModel(dataset, selectedModel)
              : undefined;
            return (
              <Card key={dataset.id}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold">{dataset.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {dataset.description || 'No description provided.'}
                      </p>
                    </div>
                    <Badge>
                      {mode === 'model' && modelCount === selectedModel?.requiredCount
                        ? 'Complete input match'
                        : 'MINT-ready'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(dataset.matched_variables ?? dataset.variables)
                      .slice(0, 6)
                      .map((variable) => (
                        <Badge key={variable} variant="secondary">
                          {variable}
                        </Badge>
                      ))}
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                    <span>Source: {dataset.source.name || 'Unknown'}</span>
                    <span>
                      Coverage:{' '}
                      {dataset.spatial_coverage
                        ? 'Spatial coverage available'
                        : 'Spatial coverage unknown'}
                    </span>
                    <span>
                      Time: {dataset.time_period?.start_date?.getFullYear() ?? 'Unknown'}–
                      {dataset.time_period?.end_date?.getFullYear() ?? 'Unknown'}
                    </span>
                    {dataset.datatype && <span>Format: {dataset.datatype}</span>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setPanelDataset(dataset)}>
                      Models
                    </Button>
                    <Button size="sm" variant="secondary" asChild>
                      <Link to={`/datasets/browse/${encodeURIComponent(dataset.id)}`}>
                        View profile
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        {!loading && visibleDatasets.length === 0 && !error && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No MINT-ready datasets match these filters.
          </p>
        )}
      </div>

      <DatasetCompatibilityPanel
        dataset={panelDataset}
        open={Boolean(panelDataset)}
        onClose={() => setPanelDataset(null)}
      />
    </div>
  );
}
