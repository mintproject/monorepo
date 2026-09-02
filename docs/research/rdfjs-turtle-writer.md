# Which RDF/JS package writes the Turtle?

Research for [#215](https://github.com/mintproject/monorepo/issues/215), under map
[#214](https://github.com/mintproject/monorepo/issues/214).

**Date:** 2026-09-02. **Consumer:** `model-catalog-api` (`"type": "module"`, TypeScript 5.9,
`module`/`moduleResolution: Node16`, Fastify 5, Node 24).

## Recommendation

**Use `n3`, with `@types/n3` as a dev dependency.**

Two runtime packages enter the tree (`buffer`, `readable-stream`) instead of the 8–68 the
alternatives pull. `n3` bundles its own `DataFactory`, so no companion data-model package is
needed. It is the only candidate whose Turtle output is checked in CI against the official
W3C RDF 1.1 and RDF 1.2 test suites, and the only maintained candidate that can stream.

```
npm install n3
npm install -D @types/n3
```

## Candidates

The shortlist comes from the library index published on
[rdf.js.org](https://rdf.js.org/), which lists 74 libraries. Only two of them are
maintained, standalone Turtle **writers**: `n3` and `@rdfjs/serializer-turtle`. The rest were
checked and eliminated below.

### Eliminated before comparison

| Package | Why it is out |
|---|---|
| `@zazuko/rdf-utils` | **Does not exist.** `npm view @zazuko/rdf-utils` returns `E404 Not Found` from `https://registry.npmjs.org/@zazuko%2frdf-utils`. |
| `@rdfjs/formats-common` | Ships no Turtle serializer. Its dependencies are `@rdfjs/serializer-jsonld` and `@rdfjs/serializer-ntriples` only (`npm view @rdfjs/formats-common dependencies`, v3.1.0). |
| `graphy` / `@graphy/content.ttl.write` | Last release **2023-10-26** (`npm view graphy time`), v4.3.7. Unmaintained for ~3 years. Licence is ISC, not MIT. |
| `@tpluscode/rdf-string` | A template-literal helper, not a document serializer. Last release 2024-09-23 (`npm view @tpluscode/rdf-string time`). rdf.js.org lists it as implementing `Dataset` only. |
| `rdflib` | See table — 122 transitive packages, 19 MB installed, and it depends on `n3` anyway (`npm view rdflib dependencies`). Using it to write Turtle means shipping `jsonld`, `@xmldom/xmldom` and `cross-fetch` to reach a serializer `n3` already provides. Its `package.json` also lists the bogus dependencies `"package-lock.json": "^1.0.0"` and `"package.json": "^2.0.1"`. |
| `rdf-serialize` | See table — a Comunica actor bus. 69 transitive packages, 26 MB. Its Turtle actor is `@comunica/actor-rdf-serialize-n3`, i.e. it wraps `n3`. Not listed on rdf.js.org. |

### Comparison

Measured on 2026-09-02 by installing each package alone into an empty project and running
`npm ls --all --parseable | wc -l` and `du -sk node_modules`.

| | `n3` | `@rdfjs/serializer-turtle` | `rdf-serialize` | `rdflib` |
|---|---|---|---|---|
| Version | 2.7.3 | 1.1.5 | 5.1.0 | 2.4.0 |
| Writes Turtle | yes | yes | yes (via `n3`) | yes |
| Streams | **yes** — `N3.StreamWriter` | **no** — buffers all quads | yes | no |
| Direct deps | **2** | 9 | 14 | 10 |
| Transitive packages | **11** | 20 | 69 | 122 |
| Install size | **1.9 MB** | 1.8 MB | 26.3 MB | 19.2 MB |
| Tarball unpacked | 814 KB | 36 KB | 39 KB | 3.6 MB |
| Last release | **2026-09-02** | 2025-02-04 | 2026-01-16 | 2026-06-24 |
| Open issues | 62 | 0 | 4 | 135 |
| GitHub stars | 795 | 4 | 9 | 597 |
| Weekly downloads | **206,540** | 16,152 | 3,631 | 9,759 |
| Bundled TS types | no | no | no | yes |
| DefinitelyTyped | `@types/n3` 1.26.3, 2026-08-29 | `@types/rdfjs__serializer-turtle` 1.1.0, 2024-01-13 | n/a | n/a |
| Native ESM | no (CJS + `module` field) | yes (`"type": "module"`) | no | dual |
| Licence | MIT | MIT | MIT | MIT |
| W3C spec suite in CI | **yes** | no | via Comunica | no |

Sources: `npm view <pkg> --json` against `https://registry.npmjs.org`;
`https://api.npmjs.org/downloads/point/last-week/<pkg>`; the GitHub API for
[rdfjs/N3.js](https://github.com/rdfjs/N3.js),
[rdfjs-base/serializer-turtle](https://github.com/rdfjs-base/serializer-turtle),
[rubensworks/rdf-serialize.js](https://github.com/rubensworks/rdf-serialize.js) and
[linkeddata/rdflib.js](https://github.com/linkeddata/rdflib.js).

## The decisive criterion: literal escaping

The ticket names escaping as decisive, because `modelcatalog_*` `description` columns are
multi-line and contain quotes.

**Both finalists are correct.** This criterion does not eliminate either one. It was tested
rather than assumed.

A literal was built containing a newline, a CRLF, an embedded `"`, a backslash, a tab,
`café`, `日本語`, the astral emoji `🌊`, several C0 control characters, and a trailing `"`.
Each writer serialized it; the output was then re-parsed with `N3.Parser` and compared to the
input string.

```
n3 round-trip identical:    true
rdfjs round-trip identical: true
```

`n3` emits:

```turtle
<https://w3id.org/okn/i/mint/thing> sd:description "Line one\nLine two with \"embedded quotes\" and a backslash \\ plus a tab\there.\r\nUnicode: café, 日本語, emoji \U0001f30a, ...";
```

The difference is how conservative each writer is. `n3` escapes `"`, `\`, tab, LF, CR,
backspace, form feed, every character in `U+0000`–`U+0019`, and surrogate pairs as `\U`
escapes. The escape set is declared in `N3Writer.js`:

```js
// n3/src/N3Writer.js lines 13-14
const escape    = /["\\\t\n\r\b\f\u0000-\u0019\ud800-\udbff]/,
      escapeAll = /["\\\t\n\r\b\f\u0000-\u0019]|[\ud800-\udbff][\udc00-\udfff]/g,
```

`@rdfjs/serializer-turtle` delegates to `@rdfjs/to-ntriples` and escapes only what the
grammar forbids. It emits a raw tab byte and raw C0 control bytes inside the quoted string.

Both are valid. The [Turtle grammar](https://www.w3.org/TR/turtle/#grammar-production-STRING_LITERAL_QUOTE)
defines `STRING_LITERAL_QUOTE ::= '"' ( [^#x22#x5C#xA#xD] | ECHAR | UCHAR )* '"'`, so tab
(`#x09`) and `BEL` (`#x07`) are permitted unescaped. `n3` escapes them anyway, which keeps
the HTTP response body free of raw control bytes and keeps it readable in a terminal or a
diff. That is a small operational win, not a correctness one.

**Conclusion for the map:** the hand-rolled-template risk that decision 10 identified is real
and is eliminated by either package. Escaping is not the tie-breaker. Dependency weight,
maintenance and streaming are.

## IRI validation: neither package validates

The map records 5 rows whose `id` is an RDFLib blank-node label such as
`n82760779be9543bd84f0a41be7d5a72ab1`. Both writers were fed one as a `NamedNode`, and also
fed an outright invalid IRI containing a space.

| Input | `n3` | `@rdfjs/serializer-turtle` |
|---|---|---|
| `n82760779be9543bd84f0a41be7d5a72ab1` | emits `<n82760779...>`, re-parses OK | emits `<n82760779...>`, re-parses OK |
| `https://example.org/has a space` | emits `<https://example.org/has a space>`, **re-parse fails** | emits it raw, **re-parse fails** |

Neither package validates. Both emit whatever they are given.

This has two consequences for the implementation ticket
([#220](https://github.com/mintproject/monorepo/issues/220)):

1. **The blank-node ids are the dangerous case, not the loud one.** `<n8276...>` is a
   syntactically valid *relative* IRI reference. It parses without error and silently
   resolves against the document base. The output is wrong but never fails. Guarding these 5
   rows is application work; no package choice removes it.
2. **The percent-encoded SVO `same_as` values are fine.** The map lists this as an open
   question. A representative value,
   `https://w3id.org/def/i-adopt/variable#%28land_surface%29%40context%7Eon_`, was written
   and re-parsed successfully. Percent-encoding is preserved and legal.

## TypeScript and ESM

`model-catalog-api` is `"type": "module"` on `moduleResolution: Node16`, `strict: true`.
Both finalists were compiled against exactly that `tsconfig` with TypeScript 5.9. Both pass,
but the package counts differ.

`n3` is not native ESM. Its `package.json` has `"main": "./lib/index.js"` (Babel-compiled
CJS), a `"module"` field Node ignores, and **no `exports` field**. Under Node ESM
`import { Writer, DataFactory } from 'n3'` therefore resolves to `lib/index.js` and works via
CJS named-export interop. This was verified at runtime — `createRequire.resolve('n3')`
returns `node_modules/n3/lib/index.js` and named imports bind correctly.

To type-check `n3` you add **2** packages:

```
n3, @types/n3
```

To type-check `@rdfjs/serializer-turtle` you add **4**, because it ships no `DataFactory` and
neither it nor `@rdfjs/data-model` bundles types:

```
@rdfjs/serializer-turtle, @rdfjs/data-model,
@types/rdfjs__serializer-turtle, @types/rdfjs__data-model
```

Omitting `@types/rdfjs__data-model` fails the build with
`TS7016: Could not find a declaration file for module '@rdfjs/data-model'`.

`@types/n3` was last published **2026-08-29**, one day before `n3` 2.7.3. It is actively
tracked. `@types/rdfjs__serializer-turtle` was last published **2024-01-13**, 20 months ago.

## RDF/JS interface conformance

rdf.js.org records `n3` as implementing `DataFactory` and `Sink`, and
`@rdfjs/serializer-turtle` as implementing `Sink` and `Stream`.

The `n3` README states that `N3.StreamWriter` implements both the
[`Stream`](http://rdf.js.org/stream-spec/#stream-interface) and
[`Sink`](http://rdf.js.org/stream-spec/#sink-interface) interfaces, and `N3.Store` implements
`Store` and `Source`. `N3.StreamWriter` was confirmed present and callable at runtime.

`n3` is the stronger conformance story on the specification that matters here — the format
itself. Its `package.json` defines CI scripts that run the official
[W3C rdf-tests](https://w3c.github.io/rdf-tests/) manifests for Turtle, TriG, N-Triples and
N-Quads, under both RDF 1.1 and RDF 1.2, and publishes EARL reports:

```
"spec-1-1-turtle": "rdf-test-suite spec/parser.js https://w3c.github.io/rdf-tests/rdf/rdf11/rdf-turtle/manifest.ttl ..."
"spec-1-2-turtle": "rdf-test-suite spec/parser.js https://w3c.github.io/rdf-tests/rdf/rdf12/rdf-turtle/syntax/manifest.ttl ..."
```

It also enforces a 100% branch, function, line and statement coverage threshold in its Jest
configuration. `@rdfjs/serializer-turtle` has no W3C suite; it tests against 20 checked-in
fixture pairs.

## Maintenance

`n3` published 2.7.1, 2.7.2 and 2.7.3 on 2026-09-01 and 2026-09-02. The repository was pushed
the same day. 62 open issues against 795 stars and 206k weekly downloads is normal traffic for
a library of that reach, not a backlog signal. It is the reference Turtle implementation for
JavaScript and is a transitive dependency of `rdflib`, `rdf-serialize` and Comunica — so the
tree very likely contains it already the moment any alternative is chosen.

`@rdfjs/serializer-turtle` last released 2025-02-04, 19 months ago. Zero open issues at 4
stars means nobody is filing, not that nothing is wrong. It is maintained by one person
(Thomas Bergwinkl) under the `rdfjs-base` organisation.

## Licence

`n3` is **MIT**. Its `package.json` declares `"license": "MIT"` and `LICENSE.md` carries the
verbatim MIT text, `Copyright ©2012–present N3.js contributors`. The GitHub API reports
`NOASSERTION` for the repository, which is a licence-detector artefact of the file being named
`LICENSE.md` with a `# License` heading; the text itself is unambiguous MIT.

All four candidates are MIT. No licence conflict exists.

Note in passing: `model-catalog-api/package.json` declares `"license": "ISC"` and the
directory has no `LICENSE` file, even though commit `0b95c8c` says all four services are MIT.
That is a separate inconsistency, out of scope for this ticket.

## What this does not decide

- **Pretty-printing.** `@rdfjs/serializer-turtle` produces nicer nested output than `n3`'s
  flat `subject predicate object;` grouping. If decision 6's Concise Bounded Description is
  meant to *look* nested in the response body, that is a real trade. `n3` supports nesting
  explicitly through `writer.blank()` and `writer.list()`, so the capability exists; it is
  not automatic.
- **Buffering versus streaming.** The map lists response size as unresolved.
  `@rdfjs/serializer-turtle` closes that door — its README states plainly that *"All quads
  need to be kept in memory for pretty-printing."* `n3` keeps the option open via
  `StreamWriter`. Choosing `n3` costs nothing now and preserves the choice later.

## Reproduction

Every number and every output above came from these commands, run on 2026-09-02 with Node
24.20.0 and npm from the same toolchain.

```bash
npm view n3 --json
npm view @rdfjs/serializer-turtle --json
curl -s https://api.npmjs.org/downloads/point/last-week/n3
gh api repos/rdfjs/N3.js

# size and dependency count, per package, in an empty project
npm install n3 && npm ls --all --parseable | wc -l && du -sk node_modules
```

The escaping, round-trip, IRI and TypeScript checks were scripted against freshly installed
copies of both finalists. They are worth re-creating as real tests in
[#220](https://github.com/mintproject/monorepo/issues/220): a round-trip assertion over a
nasty literal is the regression test that decision 10 is really asking for.
