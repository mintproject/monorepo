import { useParams } from 'react-router-dom';

import { DatasetDiscovery } from '@/components/datasets/DatasetDiscovery';
import { DatasetDetail } from './DatasetDetail';

/**
 * Dataset browse page.
 *
 * - Without a dataset id: renders the first-party MINT-aware discovery UI.
 * - With a dataset id (e.g. /datasets/browse/:id): renders DatasetDetail.
 */
export function DatasetsBrowse() {
  const { id } = useParams<{ id?: string }>();

  if (id) {
    return (
      <div className="mx-auto max-w-4xl">
        <DatasetDetail datasetId={id} />
      </div>
    );
  }

  return <DatasetDiscovery />;
}
