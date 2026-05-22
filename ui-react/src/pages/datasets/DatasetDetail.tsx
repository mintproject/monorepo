import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ExternalLink, MapPin } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fetchDatasetDetail } from '@/lib/datasets/data-catalog-api';
import type { Dataset, DataResource } from '@/lib/datasets/types';

// ---------------------------------------------------------------------------
// Props — can be used standalone (via route) or embedded
// ---------------------------------------------------------------------------

interface DatasetDetailProps {
  /** Pass directly when embedding (e.g. from DatasetsBrowse). Takes precedence over route param. */
  datasetId?: string;
}

const DATASET_METADATA_FIELDS: { label: string; getValue: (ds: Dataset) => React.ReactNode }[] = [
  { label: 'Description', getValue: (ds) => ds.description || '—' },
  {
    label: 'Source',
    getValue: (ds) =>
      ds.source.url ? (
        <a
          href={ds.source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
        >
          {ds.source.name || ds.source.url}
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        ds.source.name || '—'
      ),
  },
  { label: 'Source Type', getValue: (ds) => ds.source.type || '—' },
  { label: 'Limitations', getValue: (ds) => ds.limitations || '—' },
  { label: 'Version', getValue: (ds) => ds.version || '—' },
];

/** Dataset detail page — fetches dataset from Data Catalog REST API. */
export function DatasetDetail({ datasetId: propDatasetId }: DatasetDetailProps) {
  const { id: paramId } = useParams<{ id?: string }>();
  const datasetId = propDatasetId ?? paramId;

  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRepr, setShowRepr] = useState(false);

  useEffect(() => {
    if (!datasetId) {
      setError('No dataset ID provided');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setDataset(null);

    fetchDatasetDetail(datasetId)
      .then((ds) => {
        setDataset(ds);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load dataset');
        setLoading(false);
      });
  }, [datasetId]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center py-12 text-muted-foreground"
        aria-live="polite"
      >
        Loading dataset…
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        {error}
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No resources found for this dataset.
      </div>
    );
  }

  const hasRepr = Boolean(dataset.resource_repr || dataset.dataset_repr);
  const reprData = dataset.resource_repr || dataset.dataset_repr;
  const reprLabel = dataset.resource_repr ? 'resource_repr' : 'dataset_repr';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{dataset.name}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">id: {dataset.id}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Badge variant={dataset.is_cached ? 'default' : 'secondary'}>
            {dataset.is_cached ? 'Available on MINT servers' : 'Available for download'}
          </Badge>
          {hasRepr && (
            <Button variant="outline" size="sm" onClick={() => setShowRepr(true)}>
              MINT Understandable Format
            </Button>
          )}
          {!dataset.is_cached && (
            <Button variant="outline" size="sm" disabled>
              Download to MINT servers
            </Button>
          )}
        </div>
      </div>

      {/* Metadata table */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="w-40 px-6 py-3 text-left font-medium text-muted-foreground">
                  Metadata
                </th>
                <th className="px-6 py-3 text-left font-medium text-muted-foreground">Value</th>
              </tr>
            </thead>
            <tbody>
              {DATASET_METADATA_FIELDS.map((field) => (
                <tr key={field.label} className="border-b last:border-0">
                  <td className="w-40 px-6 py-3 font-medium">{field.label}</td>
                  <td className="px-6 py-3 text-muted-foreground">{field.getValue(dataset)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Spatial coverage / map placeholder */}
      <SpatialCoverageSection dataset={dataset} />

      {/* Resources list */}
      <ResourcesSection dataset={dataset} />

      {/* MINT Understandable Format dialog */}
      {hasRepr && (
        <Dialog open={showRepr} onOpenChange={setShowRepr}>
          <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{reprLabel} details</DialogTitle>
            </DialogHeader>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-muted p-4 text-xs">
              {JSON.stringify(reprData, null, 2)}
            </pre>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SpatialCoverageSection({ dataset }: { dataset: Dataset }) {
  const hasSpatial = dataset.spatial_coverage || dataset.resources.some((r) => r.spatial_coverage);

  if (!hasSpatial) return null;

  // Collect bounding box for a static map embed
  const covers = dataset.resources.map((r) => r.spatial_coverage).filter(Boolean);

  const firstCover = dataset.spatial_coverage ?? covers[0];
  let mapUrl: string | null = null;

  if (firstCover) {
    const { type, value, coordinates } = firstCover;
    if (type?.toLowerCase() === 'point') {
      const x = value?.x ?? (coordinates as number[][])?.[0]?.[0];
      const y = value?.y ?? (coordinates as number[][])?.[0]?.[1];
      if (x !== undefined && y !== undefined) {
        mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${x - 1},${y - 1},${x + 1},${y + 1}&layer=mapnik&marker=${y},${x}`;
      }
    } else if (type?.toLowerCase() === 'boundingbox') {
      const xmin = value?.xmin ?? (coordinates as number[][])?.[0]?.[0];
      const xmax = value?.xmax ?? (coordinates as number[][])?.[0]?.[2];
      const ymin = value?.ymin ?? (coordinates as number[][])?.[0]?.[1];
      const ymax = value?.ymax ?? (coordinates as number[][])?.[0]?.[3];
      if (xmin !== undefined && xmax !== undefined && ymin !== undefined && ymax !== undefined) {
        mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${xmin},${ymin},${xmax},${ymax}&layer=mapnik`;
      }
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-base font-semibold">Spatial Coverage</h3>
      </div>
      {mapUrl ? (
        <div className="h-64 overflow-hidden rounded-lg border">
          <iframe
            src={mapUrl}
            title="Dataset spatial coverage map"
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin"
            aria-label="Map showing dataset spatial coverage"
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Spatial coverage data available but cannot be visualized.
        </p>
      )}
    </div>
  );
}

function ResourcesSection({ dataset }: { dataset: Dataset }) {
  const { resources, resource_count } = dataset;
  if (resource_count === 0 && resources.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold">
        {resources.length < (resource_count ?? 0) && <span>Showing {resources.length} of </span>}
        {resource_count ?? resources.length} Resource
        {(resource_count ?? resources.length) !== 1 ? 's' : ''}
      </h3>

      <Card>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-y-auto">
            <ul className="divide-y">
              {resources.map((res) => (
                <ResourceItem key={res.id} resource={res} />
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ResourceItem({ resource }: { resource: DataResource }) {
  return (
    <li className="px-4 py-3">
      <p className="text-sm font-medium">{resource.name}</p>
      <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
        <li>
          Download:{' '}
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-primary underline underline-offset-2"
          >
            {resource.url}
          </a>
        </li>
        {resource.time_period?.start_date && (
          <li>
            Time: {resource.time_period.start_date.toLocaleDateString('en-US')}
            {resource.time_period.end_date &&
              ` to ${resource.time_period.end_date.toLocaleDateString('en-US')}`}
          </li>
        )}
      </ul>
    </li>
  );
}
