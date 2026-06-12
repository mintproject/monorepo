# Semantic Web Standards

**Summary**: The W3C technologies — RDF, OWL, SKOS, SPARQL — used to formalize and query the Scientific Variables Ontology.

**Sources**: Peckham_and_Stoica_2022_ICWRER_2022.pdf, garijo-etal-escience19.pdf, MINT-tiis.pdf

**Last updated**: 2026-06-06

---

The [[scientific-variables-ontology]] is formalized using Semantic Web best practices and tools — those sanctioned by the **W3C** (World Wide Web Consortium), the main international standards body for the Web (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf).

## Standards used by SVO

(source: Peckham_and_Stoica_2022_ICWRER_2022.pdf)

- **RDF** — Resource Description Framework.
- **OWL** — Web Ontology Language, a family of knowledge representation languages.
- **SKOS** — Simple Knowledge Organization System, a "crosswalk standard" for connecting vocabularies.
- **SPARQL** — SPARQL Protocol and RDF Query Language, used to query SVO.

SVO is available online (geoscienceontology.org), and its variables will have permanent URLs at **w3id.org** (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf).

## Use across MINT / OKG-Soft

[[okg-soft|OKG-Soft]] and the [[model-catalog]] are built on the same stack (source: garijo-etal-escience19.pdf, MINT-tiis.pdf):

- **RDF** as the unified data model; ontologies published at **`w3id.org/okn/o/...`** with permanent URI structure (see [[linked-data]]).
- **SPARQL** endpoints organized in **named graphs** so each contributor edits their own graph.
- **JSON-LD** for developer-facing REST APIs (alongside plain JSON).
- Reuse of **Schema.org/Codemeta**, **W3C Data Cube**, and **QUDT** vocabularies.

> Note: This RDF/triplestore lineage is directly relevant to the surrounding codebase: MINT's model catalog migrated from an RDF triplestore (Apache Fuseki) to PostgreSQL + Hasura GraphQL. SVO itself remains an RDF/OWL ontology.

## Related pages

- [[scientific-variables-ontology]]
- [[i-adopt]]
- [[fair-principles]]
- [[okg-soft]]
- [[model-catalog]]
- [[linked-data]]
