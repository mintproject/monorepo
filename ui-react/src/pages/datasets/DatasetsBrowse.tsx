import { useParams } from 'react-router-dom';

import { getDataCatalogBrowseUrl } from '@/lib/config';

import { DatasetDetail } from './DatasetDetail';

/**
 * Dataset browse page.
 *
 * - Without a dataset id: renders an iframe to the external data catalog UI.
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

  const catalogUrl = getDataCatalogBrowseUrl();

  return (
    <div
      className="h-[calc(100vh-10rem)] w-full overflow-hidden rounded-lg border"
      aria-label="External data catalog"
    >
      <iframe
        src={catalogUrl}
        title="MINT Data Catalog"
        className="h-full w-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}
