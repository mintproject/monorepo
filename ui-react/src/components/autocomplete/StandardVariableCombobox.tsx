/**
 * StandardVariableCombobox
 *
 * Domain-grouped, rank-searched picker for Standard Variables. Data is
 * prefetched from the Apollo cache (cache-first) — all grouping/ranking is
 * synchronous and client-side. Filtering is taken off cmdk (shouldFilter
 * false); ranking + grouping come from lib/standard-variable-search, category
 * assignment from lib/standard-variable-taxonomy, recency from
 * hooks/useRecentStandardVariables. UUID/unnamed rows are demoted into an
 * "Unnamed / Other" group with their description shown as the name.
 */

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { usePrefetchReferenceDataQuery } from '@/graphql/generated/graphql';
import { useRecentStandardVariables } from '@/hooks/useRecentStandardVariables';
import {
  RECENT_GROUP_KEY,
  buildStandardVariableGroups,
  highlightRanges,
} from '@/lib/standard-variable-search';
import { isUnnamedLabel } from '@/lib/standard-variable-taxonomy';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface StandardVariableOption {
  id: string;
  label: string;
  description: string | null;
}

export interface StandardVariableComboboxProps {
  /** Currently selected standard variable, or null if none selected. */
  value: StandardVariableOption | null;
  /** Called when selection changes. Receives null when cleared. */
  onChange: (sv: StandardVariableOption | null) => void;
  /** Optional placeholder text for the trigger button. */
  placeholder?: string;
  /** Disables the combobox. */
  disabled?: boolean;
  /** Additional className for the trigger button. */
  className?: string;
  /** When provided, renders a "request a new standard variable" footer action. */
  onRequestNew?: () => void;
}

/** Render text with every matched query substring highlighted. */
function Highlighted({ text, query }: { text: string; query: string }) {
  const ranges = highlightRanges(text, query);
  if (ranges.length === 0) return <>{text}</>;
  const parts: React.ReactNode[] = [];
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

export function StandardVariableCombobox({
  value,
  onChange,
  placeholder = 'Search standard variables...',
  disabled = false,
  className,
  onRequestNew,
}: StandardVariableComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  // Reads from Apollo cache — cache-first means no network call if already fetched
  const { data, loading } = usePrefetchReferenceDataQuery({ fetchPolicy: 'cache-first' });

  const options: StandardVariableOption[] = React.useMemo(() => {
    if (!data?.modelcatalog_standard_variable) return [];
    return data.modelcatalog_standard_variable.map((sv) => ({
      id: sv.id,
      label: sv.label ?? '',
      description: sv.description ?? null,
    }));
  }, [data]);

  const { recent, recordUse } = useRecentStandardVariables();

  const result = React.useMemo(
    () =>
      buildStandardVariableGroups(
        options,
        recent.map((r) => r.id),
        search,
      ),
    [options, recent, search],
  );

  const handleSelect = React.useCallback(
    (selectedId: string) => {
      if (value?.id === selectedId) {
        onChange(null);
      } else {
        const found = options.find((o) => o.id === selectedId) ?? null;
        onChange(found);
        if (found) recordUse(found);
      }
      setOpen(false);
      setSearch('');
    },
    [value, options, onChange, recordUse],
  );

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setSearch('');
  }, []);

  // Mirror the in-list demotion on the closed trigger: never surface a raw
  // UUID/unnamed label — show its description (or a friendly placeholder).
  const triggerLabel = value
    ? isUnnamedLabel(value.label)
      ? (value.description ?? 'Unnamed variable')
      : value.label
    : placeholder;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select standard variable"
          disabled={disabled || loading}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className={cn('truncate', !value && 'text-muted-foreground')}>
            {loading ? 'Loading...' : triggerLabel}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={placeholder} value={search} onValueChange={setSearch} />
          <CommandList>
            {result.groups.length === 0 ? (
              <CommandEmpty>No matching standard variables.</CommandEmpty>
            ) : (
              <>
                {search.trim() !== '' && (
                  <div className="px-3 py-1.5 text-[11px] text-muted-foreground">
                    Showing {result.matchCount} of {result.total} · best matches first
                  </div>
                )}
                {result.groups.map((group) => (
                  <CommandGroup
                    key={group.key}
                    heading={
                      <span className="flex items-center justify-between">
                        <span>{group.key}</span>
                        {group.key !== RECENT_GROUP_KEY && (
                          <span className="rounded-full bg-muted px-1.5 text-[10px] font-normal text-muted-foreground">
                            {group.options.length}
                          </span>
                        )}
                      </span>
                    }
                  >
                    {group.options.map((opt) => (
                      <CommandItem
                        key={opt.id}
                        value={opt.id}
                        onSelect={() => handleSelect(opt.id)}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4 shrink-0',
                            value?.id === opt.id ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                        <div className="flex min-w-0 flex-col">
                          <span
                            className={cn(
                              'truncate font-medium',
                              opt.isUnnamed && 'text-muted-foreground',
                            )}
                          >
                            <Highlighted text={opt.displayLabel} query={search} />
                          </span>
                          {opt.isUnnamed
                            ? opt.label !== opt.displayLabel && (
                                <span className="truncate font-mono text-[10px] text-muted-foreground/60">
                                  {opt.label}
                                </span>
                              )
                            : opt.description && (
                                <span className="line-clamp-1 text-xs text-muted-foreground">
                                  {opt.description}
                                </span>
                              )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </>
            )}
            {onRequestNew && (
              <CommandGroup className="border-t">
                <CommandItem
                  value="__request_new_standard_variable__"
                  onSelect={() => {
                    onRequestNew();
                    setOpen(false);
                  }}
                  className="text-primary"
                >
                  + Request a new standard variable
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
