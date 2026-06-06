/**
 * UnitCombobox
 *
 * Client-side filtered combobox for Units.
 * Data is prefetched from Apollo cache (cache-first policy) — no network call per keystroke.
 *
 * Filter: case-insensitive substring match on label only (Units have no description field).
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

export interface UnitOption {
  id: string;
  label: string;
}

export interface UnitComboboxProps {
  /** Currently selected unit, or null if none selected. */
  value: UnitOption | null;
  /** Called when selection changes. Receives null when cleared. */
  onChange: (unit: UnitOption | null) => void;
  /** Optional placeholder text for the trigger button. */
  placeholder?: string;
  /** Disables the combobox. */
  disabled?: boolean;
  /** Additional className for the trigger button. */
  className?: string;
}

export function UnitCombobox({
  value,
  onChange,
  placeholder = 'Search units...',
  disabled = false,
  className,
}: UnitComboboxProps) {
  const [open, setOpen] = React.useState(false);

  // Reads from Apollo cache — cache-first means no network call if already fetched
  const { data, loading } = usePrefetchReferenceDataQuery({ fetchPolicy: 'cache-first' });

  const options: UnitOption[] = React.useMemo(() => {
    if (!data?.modelcatalog_unit) return [];
    return data.modelcatalog_unit.map((u) => ({
      id: u.id,
      label: u.label ?? '',
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
          aria-label="Select unit"
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
            <CommandEmpty>No matching units.</CommandEmpty>
            <CommandGroup>
              {options.map((unit) => (
                <CommandItem
                  key={unit.id}
                  value={unit.label}
                  onSelect={() => handleSelect(unit.id)}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 shrink-0',
                      value?.id === unit.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span>{unit.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
