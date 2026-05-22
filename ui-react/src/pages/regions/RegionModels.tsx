import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe, ChevronDown, ChevronRight } from 'lucide-react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useGetModelTreeQuery } from '@/graphql/generated/graphql';

interface RegionModelsProps {
  regionId: string;
  regionName: string;
  regionType: string;
}

interface CategorizedSetup {
  id: string;
  label?: string | null;
  modelId: string;
  versionId: string;
  configId: string;
}

interface CategorizedSetups {
  [category: string]: CategorizedSetup[];
}

/**
 * Models for a selected region — queried from Hasura model catalog.
 *
 * The legacy app matched setups to regions via spatial bounding box intersection
 * using the model-catalog-api (RDF layer). In this React port we show model
 * configurations from Hasura. Full spatial matching requires GeoShape data
 * from the model catalog API; here we list all configurations grouped by
 * software model as a 1:1 structural port of the panel.
 */
export function RegionModels({ regionName }: RegionModelsProps) {
  const { data, loading } = useGetModelTreeQuery();

  const categorized: CategorizedSetups = useMemo(() => {
    if (!data?.modelcatalog_software) return {};

    const result: CategorizedSetups = {};
    data.modelcatalog_software.forEach((software) => {
      software.versions?.forEach((version) => {
        version.configurations?.forEach((config) => {
          const category = software.label ?? 'Uncategorized';
          if (!result[category]) result[category] = [];
          result[category].push({
            id: config.id,
            label: config.label,
            modelId: software.id,
            versionId: version.id,
            configId: config.id,
          });
        });
      });
    });
    return result;
  }, [data]);

  const totalSetups = Object.values(categorized).reduce((acc, arr) => acc + arr.length, 0);

  function getModelUrl(setup: CategorizedSetup): string {
    const configSlug = setup.configId.split('/').pop() ?? setup.configId;
    return `/models/configure/${configSlug}`;
  }

  return (
    <div className="mt-6">
      <h4 className="text-base font-semibold mb-3">
        Models for <span className="text-primary">{regionName}</span>
      </h4>

      {loading ? (
        <div className="flex justify-center py-4">
          <LoadingSpinner />
        </div>
      ) : totalSetups === 0 ? (
        <p className="text-sm text-muted-foreground px-4 pb-4">No models for this region</p>
      ) : (
        <div className="space-y-2">
          {Object.entries(categorized).map(([category, setups]) => (
            <ModelCategoryExpander
              key={category}
              category={category}
              setups={setups}
              getModelUrl={getModelUrl}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ModelCategoryExpanderProps {
  category: string;
  setups: CategorizedSetup[];
  getModelUrl: (setup: CategorizedSetup) => string;
}

function ModelCategoryExpander({ category, setups, getModelUrl }: ModelCategoryExpanderProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border rounded">
      <button
        className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-gray-50"
        onClick={() => setOpen((o) => !o)}
      >
        <div>
          <span className="font-medium text-sm">{category} models</span>
          <span className="ml-2 text-xs text-muted-foreground">
            {setups.length} configuration{setups.length !== 1 ? 's' : ''} found
          </span>
        </div>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {open && (
        <ul className="divide-y border-t">
          {setups.map((setup) => (
            <li key={setup.id}>
              <Link
                to={getModelUrl(setup)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 no-underline"
              >
                <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">{setup.label ?? setup.id.split('/').pop()}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
