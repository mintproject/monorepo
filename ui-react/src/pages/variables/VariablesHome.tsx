import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ChevronDown, ChevronUp, ChevronsUpDown, Copy, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState, useCallback, type ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useGetStandardVariablesWithUnitsQuery } from '@/graphql/generated/graphql';
import type { GetStandardVariablesWithUnitsQuery } from '@/graphql/generated/graphql';
import { highlightRanges } from '@/lib/standard-variable-search';
import { searchVariableRows } from '@/lib/variable-catalog-search';

type StandardVariable =
  GetStandardVariablesWithUnitsQuery['modelcatalog_standard_variable'][number];

type StandardVariableUnit = { id: string; label: string };

/** A standard variable enriched with its deduplicated set of units. */
type StandardVariableRow = StandardVariable & { units: StandardVariableUnit[] };

/**
 * Gather the units a standard variable is available in through its
 * variable_presentations reverse relationship, deduplicated by unit id.
 */
function dedupeUnits(variable: StandardVariable): StandardVariableUnit[] {
  const seen = new Map<string, StandardVariableUnit>();
  for (const presentation of variable.variable_presentations) {
    const unit = presentation.unit;
    if (unit && !seen.has(unit.id)) {
      seen.set(unit.id, { id: unit.id, label: unit.label });
    }
  }
  return Array.from(seen.values());
}

// ─── Highlight helper ─────────────────────────────────────────────────────────

/** Render `text` with the case-insensitive query substrings wrapped in <mark>. */
function Highlighted({ text, query }: { text: string; query: string }) {
  const ranges = highlightRanges(text, query);
  if (ranges.length === 0) return <>{text}</>;
  const parts: ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], i) => {
    if (cursor < start) parts.push(text.slice(cursor, start));
    parts.push(
      <mark key={i} className="rounded-sm bg-yellow-200 px-0.5 text-inherit">
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

// ─── Column definition ────────────────────────────────────────────────────────

/**
 * Columns are built per-query so cells can highlight the matched substrings.
 * `query` is the trimmed search string ('' when not searching).
 */
function buildColumns(query: string): ColumnDef<StandardVariableRow>[] {
  return [
    {
      id: 'copy',
      header: '',
      cell: ({ row }) => <CopyButton value={row.original.label ?? ''} />,
      enableSorting: false,
      enableColumnFilter: false,
      size: 48,
    },
    {
      id: 'standard_variable',
      accessorFn: (row) => row.label ?? '',
      header: 'Standard Variable',
      cell: ({ row }) => {
        const label = row.original.label ?? 'Unnamed';
        const description = row.original.description ?? 'No description available';
        return (
          <div>
            <div className="font-medium text-[#2c3e50]">
              <Highlighted text={label} query={query} />
            </div>
            <div className="break-words pr-4 text-sm leading-relaxed text-[#6c757d]">
              <Highlighted text={description} query={query} />
            </div>
          </div>
        );
      },
    },
    {
      id: 'units',
      header: 'Units',
      enableSorting: false,
      cell: ({ row }) => {
        const units = row.original.units;
        if (units.length === 0) {
          return <span className="text-sm italic text-[#adb5bd]">No units</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {units.map((unit) => (
              <Badge key={unit.id} variant="secondary" className="font-normal">
                <Highlighted text={unit.label} query={query} />
              </Badge>
            ))}
          </div>
        );
      },
    },
  ];
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [value]);

  return (
    <div className="group relative inline-block">
      <button
        type="button"
        onClick={handleCopy}
        title="Copy standard variable name"
        aria-label="Copy standard variable name"
        className="inline-flex h-8 w-8 items-center justify-center rounded text-[#6c757d] opacity-60 transition-all hover:bg-[#f1f3f5] hover:opacity-100"
      >
        <Copy size={16} />
      </button>
      {/* Tooltip */}
      <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/4 whitespace-nowrap rounded bg-[#2c3e50] px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
        {copied ? 'Copied!' : 'Click to copy standard variable name'}
      </span>
    </div>
  );
}

// ─── Sort icon ────────────────────────────────────────────────────────────────

function SortIcon({ direction }: { direction: 'asc' | 'desc' | false }) {
  if (direction === 'asc') return <ChevronUp size={14} />;
  if (direction === 'desc') return <ChevronDown size={14} />;
  return <ChevronsUpDown size={14} className="opacity-40" />;
}

// ─── Explanation section ──────────────────────────────────────────────────────

function ExplanationSection({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={onToggle}
        className="mb-3 flex items-center gap-1 text-sm text-[#6c757d] hover:text-[#495057]"
        aria-expanded={expanded}
      >
        <ChevronRight
          size={16}
          className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
        />
        {expanded ? 'Hide explanation' : 'Show explanation'}
      </button>

      {expanded && (
        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <h4 className="mb-2 text-sm font-semibold text-[#2c3e50]">
              What is a Standard Variable?
            </h4>
            <p className="text-sm leading-relaxed text-[#6c757d]">
              A standard variable is necessary to refer to all variables using the same nomenclature
              in a domain ontology. For example, a standard variable may be a{' '}
              <a
                href="http://www.geoscienceontology.org/geo-upper#Variable"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                SVO variable
              </a>
              . Standard variables serve as the common language that connects data and models across
              the catalog.
            </p>
          </div>

          <div className="rounded-lg bg-white p-4 shadow-sm">
            <h4 className="mb-2 text-sm font-semibold text-[#2c3e50]">What are Units?</h4>
            <p className="text-sm leading-relaxed text-[#6c757d]">
              The Units column lists the units a standard variable has been used with across the
              catalog. A variable can appear in several units; a variable with no recorded usage
              shows no units.
            </p>
          </div>

          <div className="rounded-lg bg-white p-4 shadow-sm md:col-span-2">
            <h4 className="mb-2 text-sm font-semibold text-[#2c3e50]">
              How to Use Standard Variables
            </h4>
            <p className="text-sm leading-relaxed text-[#6c757d]">
              The standard variable will be required on your model inputs and datasets (data
              catalog). Use the search bar below to find the appropriate standard variable for your
              data or model. You can click the copy button next to each variable to easily copy its
              name.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/** Explore Variables — searchable, sortable, paginated standard-variable catalog. */
export function VariablesHome() {
  const { data, loading, error } = useGetStandardVariablesWithUnitsQuery();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState('');
  const [explanationExpanded, setExplanationExpanded] = useState(true);

  const query = search.trim();
  const isSearching = query !== '';

  const rows = useMemo<StandardVariableRow[]>(
    () =>
      (data?.modelcatalog_standard_variable ?? []).map((variable) => ({
        ...variable,
        units: dedupeUnits(variable),
      })),
    [data],
  );

  // While searching, results are relevance-ranked (name > description > unit
  // label) and column sorting is disabled; otherwise the full list is shown and
  // columns are sortable. Pagination applies to the resulting list in both states.
  const displayRows = useMemo<StandardVariableRow[]>(
    () => (isSearching ? searchVariableRows(rows, query) : rows),
    [rows, query, isSearching],
  );

  const columns = useMemo(() => buildColumns(query), [query]);

  const table = useReactTable({
    data: displayRows,
    columns,
    state: { sorting: isSearching ? [] : sorting },
    onSortingChange: setSorting,
    enableSorting: !isSearching,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
    // The ranked `displayRows` reference changes whenever the query changes;
    // react-table's default autoReset would resync page state on every data
    // change, which combined with Apollo's fresh result objects can loop. Manage
    // the page reset explicitly instead (see below).
    autoResetPageIndex: false,
  });

  // Start each new/changed search (and each return to the unfiltered list) at
  // the first page so pagination applies from the top of the ranked results.
  useEffect(() => {
    table.setPageIndex(0);
  }, [query, table]);

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#212529]">Explore Variables</h1>
          <p className="mt-1 text-base text-[#6c757d]">
            Standard variables and the units they are used in
          </p>
        </div>
      </div>

      {/* Collapsible explanation */}
      <ExplanationSection
        expanded={explanationExpanded}
        onToggle={() => setExplanationExpanded((v) => !v)}
      />

      {/* Search bar */}
      <div className="mb-4 flex items-center rounded-lg bg-white px-4 py-2 shadow-sm">
        <Input
          type="text"
          placeholder="Search standard variables..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-none text-[#495057] shadow-none placeholder:text-[#adb5bd] focus-visible:ring-0"
          aria-label="Search standard variables"
        />
      </div>

      {/* Table */}
      <div className="relative overflow-visible rounded-lg bg-white shadow-sm">
        {loading && (
          <div className="p-8 text-center text-[#6c757d]">Loading standard variables…</div>
        )}

        {error && (
          <div className="p-8 text-center text-red-600">
            Failed to load standard variables. {error.message}
          </div>
        )}

        {!loading && !error && (
          <table className="w-full border-collapse" role="table" aria-label="Standard variables">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                      className="sticky top-0 z-10 border-b-2 border-[#dee2e6] bg-[#f8f9fa] px-4 py-3 text-left text-sm font-semibold text-[rgb(72,72,72)]"
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="flex items-center gap-1 hover:text-[#495057]"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <SortIcon direction={header.column.getIsSorted()} />
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-[#6c757d]">
                    No standard variables found.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={`border-b border-[#dee2e6] transition-colors hover:bg-[#EEEEEE] ${idx % 2 === 0 ? 'bg-[#F9F9F9]' : 'bg-[#F2F2F2]'}`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 align-top text-sm text-[#212529]">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination controls */}
      {!loading && !error && table.getPageCount() > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-[#6c757d]">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()} (
            {table.getPrePaginationRowModel().rows.length} rows)
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
