import { useState, useEffect } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  fetchDataTransformations,
  fetchDataTransformation,
} from '@/lib/datasets/model-catalog-api';
import type { DataTransformation } from '@/lib/datasets/types';

/** Data transformations master/detail page. */
export function DatasetsTransformations() {
  const [transformations, setTransformations] = useState<DataTransformation[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);
  const [errorAll, setErrorAll] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<DataTransformation | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const [hideLateral, setHideLateral] = useState(false);

  // Load all transformations on mount
  useEffect(() => {
    setLoadingAll(true);
    fetchDataTransformations()
      .then((dts) => {
        setTransformations(dts);
        setLoadingAll(false);
      })
      .catch((err: unknown) => {
        setErrorAll(err instanceof Error ? err.message : 'Failed to load transformations');
        setLoadingAll(false);
      });
  }, []);

  // Load detail when selection changes
  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }

    setLoadingDetail(true);
    setErrorDetail(null);
    fetchDataTransformation(selectedId)
      .then((dt) => {
        setSelected(dt);
        setLoadingDetail(false);
      })
      .catch((err: unknown) => {
        setErrorDetail(err instanceof Error ? err.message : 'Failed to load transformation');
        setLoadingDetail(false);
      });
  }, [selectedId]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Data Transformations</h2>
        <p className="mt-1 text-muted-foreground">
          Browse and inspect available data transformation workflows.
        </p>
      </div>

      <div className="flex h-[calc(100vh-16rem)] gap-0 overflow-hidden rounded-lg border">
        {/* Left panel — list */}
        {!hideLateral && (
          <div className="w-72 shrink-0 overflow-y-auto border-r">
            {loadingAll ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                Loading…
              </div>
            ) : errorAll ? (
              <div role="alert" className="p-4 text-sm text-destructive">
                {errorAll}
              </div>
            ) : transformations.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                No data transformations found.
              </div>
            ) : (
              <ul className="divide-y" role="listbox" aria-label="Data transformations">
                {transformations.map((dt) => (
                  <li key={dt.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={dt.id === selectedId}
                      onClick={() => setSelectedId(dt.id)}
                      className={[
                        'w-full px-4 py-3 text-left text-sm transition-colors',
                        'hover:bg-accent hover:text-accent-foreground',
                        dt.id === selectedId
                          ? 'bg-accent/60 font-medium text-accent-foreground'
                          : 'text-foreground',
                      ].join(' ')}
                    >
                      {dt.label ?? shortId(dt.id)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Right panel — detail */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-end border-b px-4 py-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setHideLateral((v) => !v)}
              title={hideLateral ? 'Show list' : 'Full screen detail'}
              aria-label={hideLateral ? 'Show list' : 'Full screen detail'}
            >
              {hideLateral ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {!selectedId ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                <p className="text-lg font-medium">Data Transformations</p>
                <p className="mt-1 text-sm">
                  Select a data transformation from the list to display details.
                </p>
              </div>
            ) : loadingDetail ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                Loading…
              </div>
            ) : errorDetail ? (
              <div role="alert" className="text-sm text-destructive">
                {errorDetail}
              </div>
            ) : selected ? (
              <DataTransformationDetail transformation={selected} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DataTransformationDetail({ transformation }: { transformation: DataTransformation }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">
          {transformation.label ?? shortId(transformation.id)}
        </h3>
        <p className="mt-0.5 break-all text-xs text-muted-foreground">id: {transformation.id}</p>
      </div>

      {transformation.description && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Description</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm">{transformation.description}</p>
          </CardContent>
        </Card>
      )}

      {transformation.type && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Type</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="break-all text-sm">{transformation.type}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Extract the last segment of a URI to use as a display label. */
function shortId(id: string): string {
  return id.split('/').pop() ?? id;
}
