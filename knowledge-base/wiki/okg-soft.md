# OKG-Soft

**Summary**: An open knowledge graph that describes scientific software (and its input/output data) in a machine-readable manner, published as Linked Data to support FAIR software.

**Sources**: garijo-etal-escience19.pdf, MINT-tiis.pdf

**Last updated**: 2026-06-06

---

**OKG-Soft** is an open knowledge graph for scientific software metadata, designed to make software findable, accessible, interoperable, and reusable (see [[fair-principles]]) (source: garijo-etal-escience19.pdf). It pays special attention to describing the **expected formats and contents** of software inputs and outputs, so software can be composed and data prepared automatically.

OKG-Soft builds on the earlier **OntoSoft** registry and is organized in three components (source: garijo-etal-escience19.pdf):

1. An ontology — the [[software-description-ontology]] (`sd:`) — to capture machine-readable metadata.
2. An open knowledge graph publishing that metadata, linked to the Web of Data via [[linked-data]] principles.
3. A curation/exploitation framework with REST + SPARQL APIs (the SPARQL endpoint is organized in named graphs so each contributor edits their own graph).

## Enrichment and linking

OKG-Soft reuses and links to many vocabularies (source: garijo-etal-escience19.pdf):

- **Codemeta / Schema.org** — basic software attribution (authors, license).
- **W3C Data Cube** — dataset structure definitions.
- **[[qudt|QUDT]] + CCUT** — semantic, dimension-aware unit representation.
- **DockerPedia** — semantic descriptions of software containers (co-authored by **M. Osorio**).
- **[[scientific-variables-ontology|SVO]]** — standard variable identifiers.
- **Wikidata** — `owl:sameAs` enrichment of variables, units, and software (e.g., disambiguating "albedo").

## Applications

Demonstrated via the **Model Explorer** (browse/compare model inputs and outputs) and the **[[mint-platform|MINT]]** framework. The access/edit APIs are the `MINT-ModelCatalogQueries` and `MINT-ModelCatalogIngestionAPI` services that underpin the [[model-catalog]] (source: garijo-etal-escience19.pdf).

## Related pages

- [[software-description-ontology]]
- [[model-catalog]]
- [[mint-platform]]
- [[linked-data]]
- [[garijo-etal-2019-okg-soft]]
