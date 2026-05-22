import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Folder, ExternalLink } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import type { BoundingBox } from './regionUtils';

/** A dataset returned from CKAN. */
interface CkanDataset {
  id: string;
  name: string;
  title: string;
  notes?: string;
  num_resources?: number;
  is_cached?: boolean;
  resource_repr?: boolean;
  dataset_repr?: boolean;
}

/** CKAN search result shape. */
interface CkanSearchResult {
  success: boolean;
  result: {
    count: number;
    results: Array<{
      id: string;
      name: string;
      title: string;
      notes?: string;
      num_resources?: number;
      extras?: Array<{ key: string; value: string }>;
    }>;
  };
}

const CKAN_BASE = 'https://data.mint.isi.edu/api/3/action';
const GPM_DATASET_ID = 'adfca6fb-ad82-4be3-87d8-8f60f9193e43';

function boundingBoxToExtent(bb: BoundingBox): string {
  // CKAN spatial extent format: "minx,miny,maxx,maxy"
  return `${bb.xmin},${bb.ymin},${bb.xmax},${bb.ymax}`;
}

function buildTransformUrl(datasetId: string): string {
  return `https://data-trans.mint.isi.edu/pipeline/create?dcatId=${datasetId}`;
}

async function fetchDatasetsForRegion(boundingBox?: BoundingBox): Promise<CkanDataset[]> {
  let url: string;
  if (boundingBox) {
    const extent = boundingBoxToExtent(boundingBox);
    url = `${CKAN_BASE}/package_search?q=&ext_bbox=${extent}&rows=50`;
  } else {
    url = `${CKAN_BASE}/package_search?q=&rows=20`;
  }

  const response = await fetch(url);
  if (!response.ok) throw new Error(`CKAN request failed: ${response.status}`);
  const data = (await response.json()) as CkanSearchResult;
  if (!data.success) throw new Error('CKAN returned failure');

  return data.result.results.map((r) => ({
    id: r.id,
    name: r.name,
    title: r.title,
    notes: r.notes,
    num_resources: r.num_resources ?? 0,
    is_cached: r.extras?.some((e) => e.key === 'is_cached' && e.value === 'true') ?? false,
    resource_repr: r.extras?.some((e) => e.key === 'resource_repr' && e.value === 'true') ?? false,
    dataset_repr: r.extras?.some((e) => e.key === 'dataset_repr' && e.value === 'true') ?? false,
  }));
}

interface RegionDatasetsProps {
  regionId: string;
  regionName: string;
  boundingBox?: BoundingBox;
}

/** Datasets associated with a selected region via CKAN REST. */
export function RegionDatasets({ regionId, regionName, boundingBox }: RegionDatasetsProps) {
  const [datasets, setDatasets] = useState<CkanDataset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    setLoading(true);
    setError('');
    fetchDatasetsForRegion(boundingBox)
      .then((data) => {
        setDatasets(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load datasets');
        setLoading(false);
      });
  }, [regionId, boundingBox?.xmin, boundingBox?.ymin, boundingBox?.xmax, boundingBox?.ymax]);

  return (
    <div className="mt-6">
      <h4 className="text-base font-semibold mb-3">
        Datasets with resources in <span className="text-primary">{regionName}</span>
      </h4>

      {loading ? (
        <div className="flex justify-center py-4">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <p className="text-sm text-muted-foreground px-4 pb-4">
          Could not load datasets: {error}
        </p>
      ) : datasets.length === 0 ? (
        <p className="text-sm text-muted-foreground px-4 pb-4">No datasets for this region</p>
      ) : (
        <ul className="divide-y border rounded">
          {datasets.map((ds) => (
            <li key={ds.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50">
              <Folder className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <Link
                  to={`/datasets/detail/${ds.id}/${regionId}`}
                  className="font-medium text-sm hover:underline"
                >
                  {ds.title || ds.name}
                </Link>
                <div className="text-xs text-muted-foreground mt-0.5 flex gap-2 flex-wrap">
                  {ds.is_cached ? (
                    <span className="text-green-600">Available on MINT servers</span>
                  ) : (
                    <span className="text-orange-400">Available for download</span>
                  )}
                  {(ds.resource_repr || ds.dataset_repr) && (
                    <span className="text-green-600">| MINT Understandable Format</span>
                  )}
                  <span className="text-gray-400">— {ds.num_resources ?? 0} files</span>
                </div>
              </div>
              {ds.id === GPM_DATASET_ID && (
                <a
                  href={buildTransformUrl(ds.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-shrink-0 inline-flex items-center gap-1 text-xs border rounded px-2 py-1 hover:bg-gray-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  Transform <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
