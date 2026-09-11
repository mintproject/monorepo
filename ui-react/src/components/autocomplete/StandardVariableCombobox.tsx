/**
 * StandardVariableCombobox
 *
 * Client-side filtered combobox for Standard Variables.
 * Data is prefetched from Apollo cache (cache-first policy) — no network call per keystroke.
 *
 * Filter: case-insensitive substring match on label (primary) and description (secondary).
 * Keyboard: full ARIA combobox pattern via cmdk + Radix Popover.
 */

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { usePrefetchReferenceDataQuery } from '@/graphql/generated/graphql';
import { cn } from '@/lib/utils';
import { humanizeStandardVariable } from '@/lib/standard-variable-grammar';
import { getModelCatalogApiUrl } from '@/lib/config';
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
  models?: Array<{
    id: string;
    label: string;
    role: 'input' | 'output';
  }>;
}

export interface StandardVariableComboboxProps {
  /** Optional id used to associate the trigger with an external label. */
  id?: string;
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
}

export function StandardVariableCombobox({
  id,
  value,
  onChange,
  placeholder = 'Search standard variables...',
  disabled = false,
  className,
}: StandardVariableComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [semanticOptions, setSemanticOptions] = React.useState<StandardVariableOption[] | null>(
    null,
  );

  // Reads from Apollo cache — cache-first means no network call if already fetched
  const { data, loading } = usePrefetchReferenceDataQuery({ fetchPolicy: 'cache-first' });

  const options: StandardVariableOption[] = React.useMemo(() => {
    if (!data?.modelcatalog_standard_variable) return [];
    return data.modelcatalog_standard_variable.map((sv) => ({
      id: sv.id,
      label: sv.label?.trim() || 'Unnamed standard variable',
      description: sv.description?.trim() || (sv.label ? null : `Catalog ID: ${sv.id}`),
    }));
  }, [data]);

  React.useEffect(() => {
    const query = search.trim();
    if (query.length < 2) {
      setSemanticOptions(null);
      return;
    }
    const controller = new AbortController();
    fetch(`${getModelCatalogApiUrl()}/search?q=${encodeURIComponent(query)}&limit=50`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!body?.results) return;
        setSemanticOptions(
          body.results.map((result: StandardVariableOption) => ({
            id: result.id,
            label: result.label ?? '',
            description: result.description ?? null,
            models: result.models ?? [],
          })),
        );
      })
      .catch(() => setSemanticOptions(null));
    return () => controller.abort();
  }, [search]);

  const visibleOptions = semanticOptions?.length ? semanticOptions : options;

  const handleSelect = React.useCallback(
    (selectedId: string) => {
      if (value?.id === selectedId) {
        // Deselect on re-click
        onChange(null);
      } else {
        const found =
          visibleOptions.find((o) => o.id === selectedId) ??
          options.find((o) => o.id === selectedId) ??
          null;
        onChange(found);
      }
      setOpen(false);
    },
    [value, visibleOptions, options, onChange],
  );

  const triggerLabel =
    value?.description && !value.description.startsWith('Catalog ID:')
      ? value.description
      : value
        ? (() => {
            const { phenomenon, property } = humanizeStandardVariable(value.label);
            return phenomenon ? `${phenomenon} — ${property}` : property;
          })()
        : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
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
        <Command>
          <CommandInput placeholder={placeholder} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>No matching standard variables.</CommandEmpty>
            <CommandGroup>
              {visibleOptions.map((sv) => (
                <CommandItem
                  key={sv.id}
                  // cmdk identifies items by `value`, which must be UNIQUE. Standard
                  // variables frequently share a label (and many have no description),
                  // so a label-derived value collides across items and breaks click
                  // selection in the browser. Key by the unique id; keep label and
                  // description searchable via `keywords`.
                  value={sv.id}
                  keywords={[sv.label, sv.description ?? ''].filter(Boolean)}
                  onSelect={() => handleSelect(sv.id)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 shrink-0',
                      value?.id === sv.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <div className="flex min-w-0 flex-col">
                    {sv.description && (
                      <span className="line-clamp-1 font-medium">{sv.description}</span>
                    )}
                    <span className="line-clamp-1 text-xs text-muted-foreground">{sv.label}</span>
                    {!!sv.models?.length && (
                      <span className="line-clamp-1 text-[11px] text-muted-foreground/80">
                        {sv.models
                          .slice(0, 2)
                          .map((model) => `${model.label} (${model.role})`)
                          .join(' · ')}
                        {sv.models.length > 2 ? ` · +${sv.models.length - 2} more` : ''}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
