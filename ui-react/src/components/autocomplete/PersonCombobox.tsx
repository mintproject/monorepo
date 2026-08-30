/**
 * PersonCombobox
 *
 * On-demand Hasura query with debounced search for persons/authors.
 * Unlike StandardVariable/Unit, persons are NOT prefetched on init because
 * the list may grow large. Instead, a debounced `_ilike` query fires per keystroke.
 *
 * Debounce delay: 300ms (prevents excessive Hasura queries while typing).
 * Results: up to 50 persons ordered by label.
 */

import * as React from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';

import { useGetPersonsQuery } from '@/graphql/generated/graphql';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
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

export interface PersonOption {
  id: string;
  label: string;
  name: string | null;
}

export interface PersonComboboxProps {
  /** Currently selected person, or null if none selected. */
  value: PersonOption | null;
  /** Called when selection changes. Receives null when cleared. */
  onChange: (person: PersonOption | null) => void;
  /** Optional placeholder text for the trigger button. */
  placeholder?: string;
  /** Disables the combobox. */
  disabled?: boolean;
  /** Additional className for the trigger button. */
  className?: string;
}

export function PersonCombobox({
  value,
  onChange,
  placeholder = 'Search persons...',
  disabled = false,
  className,
}: PersonComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  // Debounce the search term to avoid hammering Hasura on every keystroke
  const debouncedSearch = useDebouncedValue(search, 300);

  // Build the _ilike pattern: empty search returns all (up to limit)
  const searchPattern = debouncedSearch ? `%${debouncedSearch}%` : undefined;

  const { data, loading } = useGetPersonsQuery({
    variables: { search: searchPattern },
    skip: !open, // Only query when the popover is open
  });

  const options: PersonOption[] = React.useMemo(() => {
    if (!data?.modelcatalog_person) return [];
    return data.modelcatalog_person.map((p) => ({
      id: p.id,
      label: p.label ?? '',
      name: p.name ?? null,
    }));
  }, [data]);

  const handleSelect = React.useCallback(
    (selectedId: string) => {
      if (value?.id === selectedId) {
        onChange(null);
      } else {
        const found = options.find((o) => o.id === selectedId) ?? null;
        onChange(found);
      }
      setOpen(false);
      setSearch('');
    },
    [value, options, onChange],
  );

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSearch('');
    }
  }, []);

  const triggerLabel = value?.label ?? placeholder;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select person"
          disabled={disabled}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className={cn('truncate', !value && 'text-muted-foreground')}>{triggerLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={placeholder} value={search} onValueChange={setSearch} />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <CommandEmpty>No matching persons.</CommandEmpty>
                <CommandGroup>
                  {options.map((person) => (
                    <CommandItem
                      key={person.id}
                      value={person.id}
                      onSelect={() => handleSelect(person.id)}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4 shrink-0',
                          value?.id === person.id ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">{person.label}</span>
                        {person.name && person.name !== person.label && (
                          <span className="text-xs text-muted-foreground">{person.name}</span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
