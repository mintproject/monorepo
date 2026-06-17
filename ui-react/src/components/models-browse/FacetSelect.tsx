/**
 * FacetSelect — a searchable multi-select facet control (shadcn Popover + Command).
 *
 * Used for Region / Model category / Output variable. Counts are intentionally
 * absent (the runtime anonymous Hasura role exposes no aggregates); the search
 * box keeps long lists (e.g. ~150 output variables) navigable.
 */
import { Check, ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface FacetOption {
  id: string;
  label: string;
}

export interface FacetSelectProps {
  label: string;
  options: FacetOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
}

export function FacetSelect({ label, options, selectedIds, onChange, loading }: FacetSelectProps) {
  const selected = new Set(selectedIds);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          disabled={loading && options.length === 0}
        >
          {label}
          {selectedIds.length > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {selectedIds.length}
            </Badge>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${label.toLowerCase()}…`} />
          <CommandList>
            <CommandEmpty>{loading ? 'Loading…' : 'No matches.'}</CommandEmpty>
            {selectedIds.length > 0 && (
              <CommandItem
                value="__clear__"
                onSelect={() => onChange([])}
                className="text-muted-foreground"
              >
                Clear selection
              </CommandItem>
            )}
            {options.map((opt) => (
              <CommandItem key={opt.id} value={opt.label} onSelect={() => toggle(opt.id)}>
                <Check
                  className={cn('mr-2 h-4 w-4', selected.has(opt.id) ? 'opacity-100' : 'opacity-0')}
                />
                <span className="truncate">{opt.label}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
