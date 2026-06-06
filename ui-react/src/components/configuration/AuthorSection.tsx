/**
 * AuthorSection — multi-select persons for configuration authorship.
 *
 * Uses PersonCombobox for autocomplete search; selected authors shown as chips.
 */
import { useFormContext, useWatch } from 'react-hook-form';
import { X } from 'lucide-react';

import { PersonCombobox } from '@/components/autocomplete/PersonCombobox';
import { Badge } from '@/components/ui/badge';
import type { ConfigurationFormSchema } from '@/schemas/configuration';

export function AuthorSection() {
  const { setValue } = useFormContext<ConfigurationFormSchema>();
  const selectedAuthors = useWatch<ConfigurationFormSchema, 'authors'>({ name: 'authors' });

  const addAuthor = (person: { id: string; label: string } | null) => {
    if (!person) return;
    const current = selectedAuthors ?? [];
    const already = current.some((a) => a.id === person.id);
    if (!already) {
      setValue('authors', [...current, { id: person.id, label: person.label }], {
        shouldDirty: true,
      });
    }
  };

  const removeAuthor = (id: string) => {
    setValue(
      'authors',
      (selectedAuthors ?? []).filter((a) => a.id !== id),
      { shouldDirty: true },
    );
  };

  return (
    <section aria-label="Authors">
      <h3 className="text-sm font-semibold mb-3">Authors</h3>

      {/* Search combobox */}
      <PersonCombobox
        value={null}
        onChange={addAuthor}
        placeholder="Search and add author..."
      />

      {/* Selected chips */}
      {(selectedAuthors?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedAuthors?.map((author) => (
            <Badge key={author.id} variant="secondary" className="gap-1 pr-1">
              {author.label || author.id}
              <button
                type="button"
                onClick={() => removeAuthor(author.id)}
                className="rounded-full hover:bg-muted p-0.5"
                aria-label={`Remove author ${author.label}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </section>
  );
}
