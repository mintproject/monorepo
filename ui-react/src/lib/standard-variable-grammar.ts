/**
 * CSDMS / SVO name grammar helpers.
 *
 * Standard-variable labels follow `[context_]object__quantity`: the double
 * underscore separates the phenomenon (object) from the property (quantity);
 * `~` and single `_` join words within a part. A label with no `__` is not
 * grammar — it is a human-named or UUID label that the guided picker routes to
 * its flat "search all" fallback rather than the phenomenon/property columns.
 */

export interface ParsedName {
  /** Phenomenon, space-joined and lower-cased. Empty for non-grammar labels. */
  object: string;
  /** Property, space-joined and lower-cased. The whole text for non-grammar labels. */
  quantity: string;
  /** True only when the label contains `__`. */
  isGrammar: boolean;
}

export interface HumanizedName {
  phenomenon: string;
  property: string;
}

const clean = (s: string): string => s.replace(/[~_]+/g, ' ').replace(/\s+/g, ' ').trim();

const sentence = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Parse a label into its object/quantity parts. Splits on the first `__`. */
export function parseCsdmsName(label: string): ParsedName {
  const trimmed = (label ?? '').trim();
  const idx = trimmed.indexOf('__');
  if (idx === -1) {
    return { object: '', quantity: trimmed, isGrammar: false };
  }
  return {
    object: clean(trimmed.slice(0, idx)),
    quantity: clean(trimmed.slice(idx + 2)),
    isGrammar: true,
  };
}

/** Display-ready, sentence-cased phenomenon + property for a label. */
export function humanizeStandardVariable(label: string): HumanizedName {
  const { object, quantity } = parseCsdmsName(label);
  return { phenomenon: sentence(object), property: sentence(quantity) };
}
