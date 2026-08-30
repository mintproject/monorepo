export interface FilterChip {
  icon: string;
  label: string;
  value: string;
  /** e.g. "from Framing" — rendered muted after the value. */
  source?: string;
}

interface FilteredByBannerProps {
  chips: FilterChip[];
  /** Optional "edit" link that jumps back to the filter source step. */
  onEdit?: () => void;
  editLabel?: string;
}

export function FilteredByBanner({ chips, onEdit, editLabel = 'edit' }: FilteredByBannerProps) {
  if (chips.length === 0) return null;

  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-2 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900"
      data-testid="filtered-by-banner"
    >
      <span className="font-medium text-blue-700">Filtered by:</span>
      {chips.map((chip) => (
        <span
          key={`${chip.label}-${chip.value}`}
          className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 ring-1 ring-blue-200"
        >
          <span aria-hidden>{chip.icon}</span>
          <span className="font-medium">{chip.label}:</span>
          <span>{chip.value}</span>
          {chip.source && <span className="text-blue-400">{chip.source}</span>}
        </span>
      ))}
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="ml-auto text-blue-600 underline hover:text-blue-800"
        >
          {editLabel}
        </button>
      )}
    </div>
  );
}
