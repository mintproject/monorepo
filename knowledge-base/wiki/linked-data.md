# Linked Data

**Summary**: The set of principles for publishing interconnected, dereferenceable data on the Web of Data — followed by OKG-Soft to publish software and model metadata.

**Sources**: garijo-etal-escience19.pdf

**Last updated**: 2026-06-06

---

**Linked Data** is the practice of publishing structured data so it can be interconnected and dereferenced over the web (the "Web of Data") (source: garijo-etal-escience19.pdf). [[okg-soft]] follows Linked Data principles to publish software and model metadata.

## How OKG-Soft applies it

(source: garijo-etal-escience19.pdf)

1. Use **dereferenceable HTTP URIs** as identifiers for all elements in the graph.
2. Use W3C standards (RDF and SPARQL — see [[semantic-web-standards]]) to return useful information when a URI is accessed.
3. **Link** relevant URIs together, including `owl:sameAs` links to external graphs like Wikidata.

OKG-Soft uses a **permanent URI structure** for long-term availability, following the convention `https://w3id.org/okn/i/[datasetID]/[instanceName]`, where `datasetID` organizes the graph (e.g., per software community) and `instanceName` identifies a resource (source: garijo-etal-escience19.pdf). All enrichment/linking code is released under a CC-BY license.

## Related pages

- [[okg-soft]]
- [[semantic-web-standards]]
- [[interoperability]]
