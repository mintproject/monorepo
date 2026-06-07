/**
 * ModelFamilyPicker — optional, controlled selector for a Model Family.
 *
 * Modes:
 *   none     → not linked (standalone configuration)
 *   existing → a chosen Software + Version pair (listed "Modflow — 2013")
 *   new      → an inline name + version form (creates Software + first Version on submit)
 *
 * Data: GetModelFamilies (Software with versions). Reuses the cmdk + Popover combobox pattern.
 */
import * as React from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';

import { useGetModelFamiliesQuery } from '@/graphql/generated/graphql';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ModelFamilyLink } from '@/schemas/registration';

interface PairOption {
  softwareId: string;
  softwareLabel: string;
  versionId: string;
  versionLabel: string;
  display: string;
}

export interface ModelFamilyPickerProps {
  value: ModelFamilyLink;
  onChange: (value: ModelFamilyLink) => void;
}

export function ModelFamilyPicker({ value, onChange }: ModelFamilyPickerProps) {
  // Internal view fallback so "Create a new family" shows the new-form even when
  // the controlled value isn't fed back (and so the picker popover can open).
  const [view, setView] = React.useState<'default' | 'new'>('default');
  const [open, setOpen] = React.useState(false);
  const [draftName, setDraftName] = React.useState('');
  const [draftVersion, setDraftVersion] = React.useState('');

  const { data, loading } = useGetModelFamiliesQuery({ fetchPolicy: 'cache-first' });

  const pairs: PairOption[] = React.useMemo(() => {
    const software = data?.modelcatalog_software ?? [];
    return software.flatMap((s) =>
      (s.versions ?? []).map((v) => ({
        softwareId: s.id,
        softwareLabel: s.label ?? '',
        versionId: v.id,
        versionLabel: v.label ?? '',
        display: `${s.label ?? ''} — ${v.label ?? ''}`,
      })),
    );
  }, [data]);

  const showNew = value.mode === 'new' || view === 'new';

  // ─── New-family form ──────────────────────────────────────────────────────

  if (showNew) {
    const familyName = value.mode === 'new' ? (value.familyName ?? draftName) : draftName;
    const versionName = value.mode === 'new' ? (value.versionName ?? draftVersion) : draftVersion;

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setDraftName(next);
      onChange({ mode: 'new', familyName: next, versionName: draftVersion });
    };

    const handleVersionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setDraftVersion(next);
      onChange({ mode: 'new', familyName: draftName, versionName: next });
    };

    const handleBackToExisting = () => {
      setView('default');
      setDraftName('');
      setDraftVersion('');
      onChange({ mode: 'none' });
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">New model family</span>
          <Button type="button" variant="ghost" size="sm" onClick={handleBackToExisting}>
            Use existing family instead
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="family-name">Family name</Label>
            <Input
              id="family-name"
              placeholder="e.g. PIHM"
              value={familyName}
              onChange={handleNameChange}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="family-version">Version</Label>
            <Input
              id="family-version"
              placeholder="e.g. 2.0"
              value={versionName}
              onChange={handleVersionChange}
            />
          </div>
        </div>
      </div>
    );
  }

  // ─── Existing selection ───────────────────────────────────────────────────

  if (value.mode === 'existing') {
    const displayLabel = `${value.softwareLabel} — ${value.versionLabel ?? value.versionId}`;

    const handleClear = () => {
      onChange({ mode: 'none' });
    };

    const handleChange = (selectedDisplay: string) => {
      const found = pairs.find((p) => p.display === selectedDisplay);
      if (found) {
        onChange({
          mode: 'existing',
          softwareId: found.softwareId,
          softwareLabel: found.softwareLabel,
          versionId: found.versionId,
          versionLabel: found.versionLabel,
        });
      }
      setOpen(false);
    };

    return (
      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="flex-1 justify-between font-normal"
            >
              <span className="truncate">{displayLabel}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search families..." />
              <CommandList>
                <CommandEmpty>No families found.</CommandEmpty>
                <CommandGroup>
                  {pairs.map((pair) => (
                    <CommandItem
                      key={`${pair.softwareId}:${pair.versionId}`}
                      value={pair.display}
                      onSelect={handleChange}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4 shrink-0',
                          value.mode === 'existing' && value.versionId === pair.versionId
                            ? 'opacity-100'
                            : 'opacity-0',
                        )}
                      />
                      <span>{pair.display}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Clear model family"
          onClick={handleClear}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // ─── None state — entry control ───────────────────────────────────────────

  const handleSelect = (selectedDisplay: string) => {
    const found = pairs.find((p) => p.display === selectedDisplay);
    if (found) {
      onChange({
        mode: 'existing',
        softwareId: found.softwareId,
        softwareLabel: found.softwareLabel,
        versionId: found.versionId,
        versionLabel: found.versionLabel,
      });
    }
    setOpen(false);
  };

  const handleCreateNew = () => {
    setView('new');
    setDraftName('');
    setDraftVersion('');
    onChange({ mode: 'new', familyName: '', versionName: '' });
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            aria-label="Link a model family"
            disabled={loading}
            className="flex-1 justify-between font-normal"
            onClick={() => setOpen(true)}
          >
            <span className="text-muted-foreground">
              {loading ? 'Loading...' : 'Link a model family'}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search families..." />
            <CommandList>
              <CommandEmpty>No families found.</CommandEmpty>
              <CommandGroup>
                {pairs.map((pair) => (
                  <CommandItem
                    key={`${pair.softwareId}:${pair.versionId}`}
                    value={pair.display}
                    onSelect={handleSelect}
                  >
                    <Check className="mr-2 h-4 w-4 shrink-0 opacity-0" />
                    <span>{pair.display}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Button type="button" variant="ghost" size="sm" onClick={handleCreateNew}>
        Create a new family
      </Button>
    </div>
  );
}
