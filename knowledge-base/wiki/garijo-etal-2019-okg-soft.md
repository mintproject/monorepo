# Garijo et al. (2019) — OKG-Soft

**Summary**: Source summary of the eScience 2019 paper introducing OKG-Soft, an open knowledge graph that describes scientific software with machine-readable metadata.

**Sources**: garijo-etal-escience19.pdf

**Last updated**: 2026-06-06

---

"OKG-Soft: An Open Knowledge Graph with Machine Readable Scientific Software Metadata" by Daniel Garijo, **Maximiliano Osorio**, Deborah Khider, Varun Ratnakar, and Yolanda Gil (USC Information Sciences Institute), 15th IEEE eScience Conference.

## Problem

Scientific software is hard to reuse: code repositories hold little machine-readable metadata about how to invoke software, prepare its data, or interpret results. Scientists spend 60–80% of their effort on data preparation when composing software into workflows (source: garijo-etal-escience19.pdf).

## Three contributions

(source: garijo-etal-escience19.pdf)

1. A modular **[[software-description-ontology]]** (`sd:`) describing software and its input/output metadata, including expected data formats and contents.
2. An approach to publish software metadata as an **[[okg-soft|open knowledge graph]]**, linked to the Web of Data following [[linked-data]] principles.
3. A framework to populate, query, explore, and curate software metadata (REST + SPARQL APIs).

## Key ideas

- Software is described at four granularities: Software → Version → Configuration, with inputs/outputs as **[[variable-presentation|variable presentations]]** linked to [[scientific-variables-ontology|SVO]] standard variables (source: garijo-etal-escience19.pdf).
- Units are represented semantically via [[qudt|QUDT]] + CCUT so dimensions can be compared and converted (source: garijo-etal-escience19.pdf).
- Reuses Codemeta/Schema.org, W3C Data Cube, DockerPedia (for containers), and links to Wikidata for enrichment.
- Demonstrated with the **Model Explorer** application and the **[[mint-platform|MINT]]** framework; references the `MINT-ModelCatalogIngestionAPI` and `MINT-ModelCatalogQueries` repos that underlie the [[model-catalog]] (source: garijo-etal-escience19.pdf).

Funded by DARPA (W911NF-18-1-0027) and NSF (ICER-1440323).

## Related pages

- [[okg-soft]]
- [[software-description-ontology]]
- [[model-catalog]]
- [[mint-platform]]
