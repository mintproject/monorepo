import { useParams } from 'react-router-dom';
import { RegionDatasets } from './RegionDatasets';
import { RegionModels } from './RegionModels';
import { useGetRegionQuery } from '@/graphql/generated/graphql';
import { calculateBoundingBox } from './regionUtils';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

/**
 * Region query page — shows datasets and models for a specific region (by URL param).
 */
export function RegionQueryPage() {
  const { id } = useParams<{ id: string }>();

  const { data, loading } = useGetRegionQuery({
    variables: { id: id ?? '' },
    skip: !id,
  });

  const region = data?.region_by_pk;
  const bbox = region ? calculateBoundingBox(region.geometries) : undefined;

  if (!id) {
    return <p className="text-sm text-muted-foreground p-4">No region selected.</p>;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (!region) {
    return <p className="text-sm text-muted-foreground p-4">Region not found.</p>;
  }

  return (
    <div className="content-page space-y-6">
      <h2 className="text-xl font-semibold">{region.name}</h2>
      <RegionModels regionId={region.id} regionName={region.name} regionType="" />
      <RegionDatasets regionId={region.id} regionName={region.name} boundingBox={bbox ?? undefined} />
    </div>
  );
}
