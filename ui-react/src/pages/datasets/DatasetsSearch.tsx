import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { searchDatasets } from '@/lib/datasets/data-catalog-api';
import type { Dataset, DatasetQueryParameters } from '@/lib/datasets/types';

type SearchType = 'dataset_names' | 'standard_variable_names';

const SEARCH_TYPE_OPTIONS: { value: SearchType; label: string }[] = [
  { value: 'dataset_names', label: 'Dataset names' },
  { value: 'standard_variable_names', label: 'Variable names' },
];

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
          className="text-primary underline underline-offset-2"
        >
          {ds.source.name || ds.source.url}
        </a>
      ) : (
        ds.source.name || '—'
      ),
  },
  { label: 'Source Type', getValue: (ds) => ds.source.type || '—' },
  { label: 'Limitations', getValue: (ds) => ds.limitations || '—' },
  { label: 'Version', getValue: (ds) => ds.version || '—' },
];

/** Dataset search page — search form + results list. */
export function DatasetsSearch() {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('dataset_names');
  const [datasets, setDatasets] = useState<Dataset[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = useCallback(async (text: string, type: SearchType) => {
    const trimmed = text.trim();

    // An empty term is a valid search: it lists every dataset in the catalog.
    // A variable term is a bare substring — the client matches it against the
    // `mint_standard_variables` annotation, so there is no wildcard to express.
    const params: DatasetQueryParameters = !trimmed
      ? {}
      : type === 'dataset_names'
        ? { name: `*${trimmed}*` }
        : { variableSubstring: trimmed };

    setLoading(true);
    setError(null);
    try {
      const results = await searchDatasets(params);
      setDatasets(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setDatasets(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runSearch(query, searchType);
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as SearchType;
    setSearchType(newType);
    setDatasets(null);
    setQuery('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Search Datasets</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The MINT dataset browser allows you to learn about the different datasets available in
          MINT. A single dataset can consist of many files (each file is called a resource).
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Search by data source name (e.g. GLDAS), keyword (e.g. crops), or standard variable name
          (e.g. precipitation).
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2" aria-label="Dataset search form">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="search-input"
            placeholder="Search datasets..."
            value={query}
            onChange={handleSearchChange}
            className="pl-8"
            aria-label="Search datasets"
          />
        </div>
        <select
          id="search-type-selector"
          value={searchType}
          onChange={handleTypeChange}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Search on"
        >
          {SEARCH_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </Button>
      </form>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="py-8 text-center text-muted-foreground" aria-live="polite">
          Searching datasets…
        </div>
      )}

      {/* Results */}
      {!loading && datasets !== null && (
        <div aria-live="polite" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Found <strong>{datasets.length}</strong> dataset{datasets.length !== 1 ? 's' : ''}
          </p>

          {datasets.map((ds) => (
            <DatasetCard key={ds.id} dataset={ds} />
          ))}

          {datasets.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">
              No datasets found. Try a different search term.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function DatasetCard({ dataset }: { dataset: Dataset }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">{dataset.name}</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">id: {dataset.id}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge variant={dataset.is_cached ? 'default' : 'secondary'}>
              {dataset.is_cached ? 'Available on MINT servers' : 'Available for download'}
            </Badge>
            {Boolean(dataset.resource_repr ?? dataset.dataset_repr) && (
              <Badge variant="outline">MINT Understandable Format</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="w-32 py-1 pr-4 text-left font-medium text-muted-foreground">
                  Metadata
                </th>
                <th className="py-1 text-left font-medium text-muted-foreground">Value</th>
              </tr>
            </thead>
            <tbody>
              {DATASET_METADATA_FIELDS.map((field) => (
                <tr key={field.label} className="border-b last:border-0">
                  <td className="w-32 py-1.5 pr-4 font-medium">{field.label}</td>
                  <td className="py-1.5 text-muted-foreground">{field.getValue(dataset)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end">
          <Link
            to={`/datasets/browse/${encodeURIComponent(dataset.id)}`}
            className="text-sm text-primary underline underline-offset-2"
          >
            More Details
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
