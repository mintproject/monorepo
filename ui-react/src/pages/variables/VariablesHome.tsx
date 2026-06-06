import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import { ChevronDown, ChevronUp, ChevronsUpDown, Copy, ChevronRight } from 'lucide-react';
import { useState, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useGetVariablePresentationsQuery } from '@/graphql/generated/graphql';
import type { GetVariablePresentationsQuery } from '@/graphql/generated/graphql';

type VariablePresentation =
  GetVariablePresentationsQuery['modelcatalog_variable_presentation'][number];

// ─── Column definition ────────────────────────────────────────────────────────

const columns: ColumnDef<VariablePresentation>[] = [
  {
    id: 'copy',
    header: '',
    cell: ({ row }) => (
      <CopyButton value={row.original.standard_variable?.label ?? row.original.label ?? ''} />
    ),
    enableSorting: false,
    enableColumnFilter: false,
    size: 48,
  },
  {
    id: 'standard_variable',
    accessorFn: (row) => row.standard_variable?.label ?? '',
    header: 'Standard Variables',
    cell: ({ getValue }) => (
      <span className="text-[#6c757d]">{(getValue() as string) || '-'}</span>
    ),
  },
  {
    id: 'label',
    accessorFn: (row) => row.label ?? '',
    header: 'Variable Presentation',
    cell: ({ row }) => {
      const label = row.original.label ?? 'Unnamed';
      const description =
        row.original.standard_variable?.description ?? 'No description available';
      return (
        <div>
          <div className="font-medium text-[#2c3e50]">{label}</div>
          <div className="text-[#6c757d] text-sm leading-relaxed break-words pr-4">
            {description}
          </div>
        </div>
      );
    },
    filterFn: (row, _columnId, filterValue: string) => {
      const q = filterValue.toLowerCase();
      const name = (row.original.label ?? '').toLowerCase();
      const desc = (row.original.standard_variable?.description ?? '').toLowerCase();
      const sv = (row.original.standard_variable?.label ?? '').toLowerCase();
      return name.includes(q) || desc.includes(q) || sv.includes(q);
    },
  },
  {
    id: 'unit',
    accessorFn: (row) => row.unit?.label ?? '',
    header: 'Units',
    cell: ({ getValue }) => (
      <span className="text-[#6c757d] italic">{(getValue() as string) || '-'}</span>
    ),
  },
];

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
    <div className="relative group inline-block">
      <button
        type="button"
        onClick={handleCopy}
        title="Copy standard variable name"
        aria-label="Copy standard variable name"
        className="w-8 h-8 inline-flex items-center justify-center rounded text-[#6c757d]
                   opacity-60 hover:opacity-100 hover:bg-[#f1f3f5] transition-all"
      >
        <Copy size={16} />
      </button>
      {/* Tooltip */}
      <span
        className="absolute bottom-full left-1/2 -translate-x-1/4 mb-2 px-2 py-1
                   bg-[#2c3e50] text-white text-xs rounded whitespace-nowrap
                   opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
      >
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
        className="flex items-center gap-1 text-[#6c757d] text-sm hover:text-[#495057] mb-3"
        aria-expanded={expanded}
      >
        <ChevronRight
          size={16}
          className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
        />
        {expanded ? 'Hide explanation' : 'Show explanation'}
      </button>

      {expanded && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h4 className="font-semibold text-[#2c3e50] mb-2 text-sm">
              What is a Standard Variable?
            </h4>
            <p className="text-[#6c757d] text-sm leading-relaxed">
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
              . Standard variables serve as the common language that connects different variable
              presentations of the same concept.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <h4 className="font-semibold text-[#2c3e50] mb-2 text-sm">
              What is a Variable Presentation?
            </h4>
            <p className="text-[#6c757d] text-sm leading-relaxed">
              A variable presentation is a concept used to represent an instantiation of a variable
              in an input/output dataset. This allows different models to use the same variable
              concept with different units or representations while maintaining semantic
              interoperability.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 md:col-span-2">
            <h4 className="font-semibold text-[#2c3e50] mb-2 text-sm">
              How to Use Standard Variables
            </h4>
            <p className="text-[#6c757d] text-sm leading-relaxed">
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

/** Variables overview — searchable, sortable, paginated variable presentation table. */
export function VariablesHome() {
  const { data, loading, error } = useGetVariablePresentationsQuery();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [explanationExpanded, setExplanationExpanded] = useState(true);

  const rows = data?.modelcatalog_variable_presentation ?? [];

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const q = filterValue.toLowerCase();
      const name = (row.original.label ?? '').toLowerCase();
      const sv = (row.original.standard_variable?.label ?? '').toLowerCase();
      const desc = (row.original.standard_variable?.description ?? '').toLowerCase();
      return name.includes(q) || sv.includes(q) || desc.includes(q);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#212529]">Explore Variables</h1>
          <p className="text-[#6c757d] text-base mt-1">
            Standard variables and variable presentations
          </p>
        </div>
      </div>

      {/* Collapsible explanation */}
      <ExplanationSection
        expanded={explanationExpanded}
        onToggle={() => setExplanationExpanded((v) => !v)}
      />

      {/* Search bar */}
      <div className="flex items-center bg-white rounded-lg shadow-sm px-4 py-2 mb-4">
        <Input
          type="text"
          placeholder="Search variable presentations..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="border-none shadow-none focus-visible:ring-0 text-[#495057] placeholder:text-[#adb5bd]"
          aria-label="Search variable presentations"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-visible relative">
        {loading && (
          <div className="p-8 text-center text-[#6c757d]">Loading variable presentations…</div>
        )}

        {error && (
          <div className="p-8 text-center text-red-600">
            Failed to load variable presentations. {error.message}
          </div>
        )}

        {!loading && !error && (
          <table className="w-full border-collapse" role="table" aria-label="Variable presentations">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                      className="bg-[#f8f9fa] px-4 py-3 text-left font-semibold text-[rgb(72,72,72)]
                                 border-b-2 border-[#dee2e6] sticky top-0 z-10 text-sm"
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
                    No variable presentations found.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={`border-b border-[#dee2e6] hover:bg-[#EEEEEE] transition-colors
                                ${idx % 2 === 0 ? 'bg-[#F9F9F9]' : 'bg-[#F2F2F2]'}`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 align-top text-[#212529] text-sm">
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
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-[#6c757d]">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()} (
            {table.getFilteredRowModel().rows.length} rows)
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
