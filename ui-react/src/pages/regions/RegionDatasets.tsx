import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Folder } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { cleanString, packageExtraFlag, searchPackages } from '@/lib/datasets/ckan';
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

async function fetchDatasetsForRegion(boundingBox?: BoundingBox): Promise<CkanDataset[]> {
  const packages = await searchPackages({
    ...(boundingBox ? { boundingBox } : {}),
    rows: boundingBox ? 50 : 20,
  });

  return packages.map((pkg) => ({
    id: cleanString(pkg.id),
    name: cleanString(pkg.name),
    title: cleanString(pkg.title),
    notes: cleanString(pkg.notes),
    num_resources: pkg.num_resources ?? 0,
    is_cached: packageExtraFlag(pkg, 'is_cached'),
    resource_repr: packageExtraFlag(pkg, 'resource_repr'),
    dataset_repr: packageExtraFlag(pkg, 'dataset_repr'),
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
      <h4 className="mb-3 text-base font-semibold">
        Datasets with resources in <span className="text-primary">{regionName}</span>
      </h4>

      {loading ? (
        <div className="flex justify-center py-4">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <p className="px-4 pb-4 text-sm text-muted-foreground">Could not load datasets: {error}</p>
      ) : datasets.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-muted-foreground">No datasets for this region</p>
      ) : (
        <ul className="divide-y rounded border">
          {datasets.map((ds) => (
            <li key={ds.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50">
              <Folder className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <Link
                  to={`/datasets/detail/${ds.id}/${regionId}`}
                  className="text-sm font-medium hover:underline"
                >
                  {ds.title || ds.name}
                </Link>
                <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
