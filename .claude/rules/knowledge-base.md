# Knowledge Base

This repo carries a domain knowledge base (an LLM Wiki) at `knowledge-base/`. It is the
single source of truth for **MINT domain concepts** — the science and metadata models behind
the code, not the code itself.

## When to consult it

Before answering or coding anything that touches these topics, read the knowledge base first:

- MINT platform concepts: goal-oriented modeling, threads/tasks/problems, model
  configuration & setup, provenance, data transformation (D-REPR / D-TRAN)
- Software & model metadata: OKG-Soft, the Software Description Ontology
  (Software > Version > Configuration > Setup), the model catalog (the `modelcatalog_*` schema),
  variable presentation, QUDT/CCUT units
- Scientific Variables Ontology (SVO): scientific variables, the Phenomenon-Property-Variable
  triad, property/process names, fluxes & flow rates, CSDMS Standard Names, ISQ/ISO 80000
- Interoperability & standards: FAIR, RDF/OWL/SKOS/SPARQL/JSON-LD, linked data, I-ADOPT

If a task names a `modelcatalog_*` table, an ontology term, a unit concept, or an SVO idea and
you are not certain what it means, the answer is likely already in the wiki — check before guessing.

## How to use it

1. Read `knowledge-base/wiki/index.md` first — it is the table of contents with one-line
   descriptions of every page.
2. Open the relevant `knowledge-base/wiki/<page>.md` pages and synthesize from them.
3. Cite the wiki pages you used in your answer.
4. If the knowledge base does not cover it, say so rather than inventing an answer.

## Maintenance

`knowledge-base/CLAUDE.md` is the full operating manual for the wiki (ingest workflow, page
format, citation rules, lint). Follow it whenever adding or editing wiki content:

- Never modify anything under `knowledge-base/raw/` — source documents are immutable.
- After changing any wiki page, update `knowledge-base/wiki/index.md` and append to
  `knowledge-base/wiki/log.md`.
- Page names are lowercase-with-hyphens; pages interlink with `[[page-name]]` wiki-links.
