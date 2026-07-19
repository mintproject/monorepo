// Generic guard against Apollo cache error #5 ("Missing field 'X' while writing
// result ...").
//
// Any type with `keyFields` in typePolicies must have those fields selected
// wherever it appears in an operation, or InMemoryCache cannot compute a cache
// key and throws at write time. This has now bitten us three times:
//   - modelcatalog_variable_presentation on /variables
//   - modelcatalog_configuration_time_interval on /modelconfigurations/:slug
//   - the nested junction chain in GetOutputVariableOptions
//
// Per-query regression tests only catch instances someone already found. This
// walks EVERY operation and fragment against the real schema and the real
// typePolicies, so a new query missing a key field fails here immediately.
import fs from 'node:fs';
import path from 'node:path';

import {
  buildSchema,
  parse,
  visit,
  visitWithTypeInfo,
  TypeInfo,
  getNamedType,
  Kind,
  type DocumentNode,
} from 'graphql';
import { describe, it, expect } from 'vitest';

import { typePolicies } from '@/lib/apollo-client';

const GRAPHQL_DIR = path.resolve(__dirname, '../graphql');

const schema = buildSchema(
  fs.readFileSync(path.join(GRAPHQL_DIR, 'generated/schema.graphql'), 'utf8'),
);

/** typename -> required key fields, for types the cache normalizes by explicit keys. */
const keyFieldsByType = new Map<string, string[]>(
  Object.entries(typePolicies ?? {}).flatMap(([typename, policy]) => {
    const keyFields = (policy as { keyFields?: unknown }).keyFields;
    return Array.isArray(keyFields) && keyFields.every((k) => typeof k === 'string')
      ? [[typename, keyFields as string[]]]
      : [];
  }),
);

const SRC_DIR = path.resolve(__dirname, '..');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(abs);
    return [abs];
  });
}

/**
 * Every GraphQL document in the app: the .graphql files, plus documents written
 * inline as gql`...` in TypeScript (region-picker.ts, generated/modeling.ts,
 * autocomplete forms, ...). Missing the inline ones would leave exactly the
 * files that hand-roll junction selections unchecked.
 *
 * generated/graphql.ts is skipped — it is emitted from the .graphql files we
 * already scan, so it can only duplicate their findings.
 */
function graphqlSources(): { file: string; source: string }[] {
  return walk(SRC_DIR).flatMap((abs) => {
    const rel = path.relative(SRC_DIR, abs);
    if (rel === path.join('graphql', 'generated', 'graphql.ts')) return [];
    // Tests are excluded on purpose: they contain deliberate negative fixtures
    // (modelTreeCache.test.ts defines a `query Bad` that OMITS key fields to
    // assert the cache rejects it). Only shipped documents are guarded here.
    if (/(^|[\\/])__tests__[\\/]|\.test\.tsx?$/.test(rel)) return [];

    if (abs.endsWith('.graphql')) {
      return [{ file: rel, source: fs.readFileSync(abs, 'utf8') }];
    }
    if (!abs.endsWith('.ts') && !abs.endsWith('.tsx')) return [];

    // Strip comments first: prose like "issued via an inline `gql` here" would
    // otherwise match and capture the comment body as a document.
    const text = fs
      .readFileSync(abs, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    const blocks = [...text.matchAll(/\bgql`([\s\S]*?)`/g)].map((m) => m[1] ?? '');
    return blocks.flatMap((block, i) => {
      // `${FRAGMENT_DOC}` interpolations compose fragments; the spread itself is
      // already in the text, so dropping the interpolation keeps it parseable.
      const source = block.replace(/\$\{[^}]*\}/g, '');
      return source.trim() ? [{ file: `${rel}#gql[${i}]`, source }] : [];
    });
  });
}

/**
 * Top-level field names each fragment contributes, resolved across ALL files
 * (operations pull fragments in via `#import`) and transitively through nested
 * spreads, so `...ConfigurationFields` counts as selecting what it selects.
 */
function collectFragmentFields(docs: DocumentNode[]): Map<string, Set<string>> {
  const spreads = new Map<string, { fields: Set<string>; spreads: string[] }>();
  for (const doc of docs) {
    for (const def of doc.definitions) {
      if (def.kind !== Kind.FRAGMENT_DEFINITION) continue;
      spreads.set(def.name.value, {
        fields: new Set(
          def.selectionSet.selections.flatMap((s) => (s.kind === Kind.FIELD ? [s.name.value] : [])),
        ),
        spreads: def.selectionSet.selections.flatMap((s) =>
          s.kind === Kind.FRAGMENT_SPREAD ? [s.name.value] : [],
        ),
      });
    }
  }

  const resolved = new Map<string, Set<string>>();
  const resolve = (name: string, seen: Set<string>): Set<string> => {
    const cached = resolved.get(name);
    if (cached) return cached;
    const entry = spreads.get(name);
    if (!entry || seen.has(name)) return new Set();
    seen.add(name);
    const out = new Set(entry.fields);
    for (const s of entry.spreads) for (const f of resolve(s, seen)) out.add(f);
    resolved.set(name, out);
    return out;
  };
  for (const name of spreads.keys()) resolve(name, new Set());
  return resolved;
}

/**
 * Every selection set whose type declares keyFields must select them.
 */
function findViolations(
  doc: DocumentNode,
  file: string,
  fragmentFields: Map<string, Set<string>>,
): string[] {
  const violations: string[] = [];
  const typeInfo = new TypeInfo(schema);

  visit(
    doc,
    visitWithTypeInfo(typeInfo, {
      SelectionSet(node) {
        const parentType = typeInfo.getParentType();
        if (!parentType) return;
        const typename = getNamedType(parentType).name;
        const required = keyFieldsByType.get(typename);
        if (!required) return;

        const selected = new Set<string>();
        for (const sel of node.selections) {
          if (sel.kind === Kind.FIELD) {
            selected.add(sel.name.value);
          } else if (sel.kind === Kind.FRAGMENT_SPREAD) {
            for (const f of fragmentFields.get(sel.name.value) ?? []) selected.add(f);
          }
        }

        const missing = required.filter((f) => !selected.has(f));
        if (missing.length > 0) {
          const line = node.loc?.startToken.line;
          violations.push(`${file}:${line ?? '?'}: ${typename} is missing ${missing.join(', ')}`);
        }
      },
    }),
  );

  return violations;
}

describe('junction key fields are selected wherever a keyed type appears', () => {
  it('has type policies to check', () => {
    // Guards the guard: a refactor that renamed/emptied typePolicies would
    // otherwise make every assertion below vacuously pass.
    expect(keyFieldsByType.size).toBeGreaterThan(20);
  });

  it('selects every declared keyField in every operation and fragment', () => {
    const unparseable: string[] = [];
    const parsed = graphqlSources().flatMap(({ file, source }) => {
      try {
        return [{ file, doc: parse(source) }];
      } catch (e) {
        // Surfaced rather than swallowed: a document we cannot parse is a
        // document we are not guarding, which is what this test exists to stop.
        unparseable.push(`${file}: ${(e as Error).message.split('\n')[0]}`);
        return [];
      }
    });
    expect(unparseable).toEqual([]);
    const fragmentFields = collectFragmentFields(parsed.map((p) => p.doc));

    const violations = parsed.flatMap(({ file, doc }) => findViolations(doc, file, fragmentFields));

    expect(violations).toEqual([]);
  });
});
