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
}

export function StandardVariableCombobox({
  value,
  onChange,
  placeholder = 'Search standard variables...',
  disabled = false,
  className,
}: StandardVariableComboboxProps) {
  const [open, setOpen] = React.useState(false);

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

  const handleSelect = React.useCallback(
    (selectedId: string) => {
      if (value?.id === selectedId) {
        // Deselect on re-click
        onChange(null);
      } else {
        const found = options.find((o) => o.id === selectedId) ?? null;
        onChange(found);
      }
      setOpen(false);
    },
    [value, options, onChange],
  );

  const triggerLabel = value?.label ?? placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>No matching standard variables.</CommandEmpty>
            <CommandGroup>
              {options.map((sv) => (
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
                  <div className="flex flex-col">
                    <span className="font-medium">{sv.label}</span>
                    {sv.description && (
                      <span className="line-clamp-1 text-xs text-muted-foreground">
                        {sv.description}
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
