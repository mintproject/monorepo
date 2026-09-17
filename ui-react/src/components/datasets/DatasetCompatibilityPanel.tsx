import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  extractModelIO,
  type ModelConfigInfo,
  type ModelSetupInfo,
  useGetModelTreeWithRegionsQuery,
} from '@/graphql/generated/modeling';
import { canonicalStandardVariable } from '@/lib/datasets/ckan';
import type { DatasetDiscoveryResult } from '@/lib/datasets/types';

interface DatasetCompatibilityPanelProps {
  dataset: DatasetDiscoveryResult | null;
  open: boolean;
  onClose: () => void;
}

interface ModelMatch {
  id: string;
  name: string;
  family: string;
  required: number;
  matchedRequired: number;
  matchedOptional: number;
  missing: string[];
  complete: boolean;
}

interface ModelCandidate {
  family: string;
  config: ModelConfigInfo | ModelSetupInfo;
}

function intersects(datasetVariables: string[], variableIds: string[], labels: string[]): boolean {
  const dataset = new Set(datasetVariables.map(canonicalStandardVariable));
  return [...variableIds, ...labels].some((value) => dataset.has(canonicalStandardVariable(value)));
}

function modelMatches(dataset: DatasetDiscoveryResult, configs: ModelCandidate[]): ModelMatch[] {
  return configs
    .map(({ family, config }) => {
      const io = extractModelIO(config);
      const required = io.inputs.filter((input) => !input.optional);
      const optional = io.inputs.filter((input) => input.optional);
      const matchedRequired = required.filter((input) =>
        intersects(dataset.variables, input.variableIds, input.variableLabels),
      );
      const matchedOptional = optional.filter((input) =>
        intersects(dataset.variables, input.variableIds, input.variableLabels),
      );
      const missing = required
        .filter((input) => !matchedRequired.includes(input))
        .map((input) => input.name);
      return {
        id: config.id,
        name: config.label ?? config.id,
        family,
        required: required.length,
        matchedRequired: matchedRequired.length,
        matchedOptional: matchedOptional.length,
        missing,
        complete: matchedRequired.length === required.length,
      };
    })
    .filter((match) => match.matchedRequired > 0 || match.matchedOptional > 0)
    .sort(
      (a, b) =>
        Number(b.complete) - Number(a.complete) ||
        b.matchedRequired - a.matchedRequired ||
        a.name.localeCompare(b.name),
    );
}

export function DatasetCompatibilityPanel({
  dataset,
  open,
  onClose,
}: DatasetCompatibilityPanelProps) {
  const navigate = useNavigate();
  const { data, loading, error } = useGetModelTreeWithRegionsQuery({ skip: !open });

  const configs = useMemo<ModelCandidate[]>(() => {
    if (!data) return [];
    return data.modelcatalog_software.flatMap((software) =>
      software.versions.flatMap((version) =>
        version.configurations.flatMap((config) =>
          config.child_configurations.length > 0
            ? config.child_configurations.map((child) => ({
                family: software.label ?? software.id,
                config: child,
              }))
            : [{ family: software.label ?? software.id, config }],
        ),
      ),
    );
  }, [data]);

  const matches = useMemo(
    () => (dataset ? modelMatches(dataset, configs) : []),
    [configs, dataset],
  );

  if (!open || !dataset) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close model compatibility panel"
        className="fixed inset-0 z-40 cursor-default bg-black/20"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Models using ${dataset.name}`}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l bg-background shadow-xl"
      >
        <div className="flex items-start justify-between border-b px-6 py-5">
          <div className="min-w-0 pr-4">
            <h2 className="text-lg font-semibold">Models using this dataset</h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">{dataset.name}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close model panel">
            Close
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading && <p className="text-sm text-muted-foreground">Loading model compatibility…</p>}
          {error && (
            <div
              role="alert"
              className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
            >
              Could not load model compatibility. The dataset listing is still available.
            </div>
          )}
          {!loading && !error && matches.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No model inputs currently match this dataset’s MINT Standard Variables.
            </p>
          )}
          <div className="space-y-3">
            {matches.map((match) => (
              <div key={match.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{match.name}</p>
                    <p className="text-xs text-muted-foreground">{match.family}</p>
                  </div>
                  <Badge variant={match.complete ? 'default' : 'secondary'}>
                    {match.complete ? 'Complete match' : 'Partial match'}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Required inputs covered: {match.matchedRequired} / {match.required}
                  {match.matchedOptional > 0 && ` · Optional inputs: ${match.matchedOptional}`}
                </p>
                {!match.complete && match.missing.length > 0 && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Missing: {match.missing.join(', ')}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={match.complete ? 'default' : 'secondary'}
                    onClick={() =>
                      navigate(
                        `/modeling/problem-statements?modelId=${encodeURIComponent(match.id)}&datasetId=${encodeURIComponent(dataset.id)}`,
                      )
                    }
                  >
                    {match.complete ? 'Start model setup' : 'Build complete run'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/modelconfigurations/${encodeURIComponent(match.id)}`)}
                  >
                    View model
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
