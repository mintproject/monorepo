# Software Description Ontology (SD / SDM)

**Summary**: The modular ontology (prefix `sd`, extended by `sdm` for models) that represents scientific software, its versions, configurations, and the structure of its input/output data.

**Sources**: garijo-etal-escience19.pdf, MINT-tiis.pdf

**Last updated**: 2026-06-06

---

The **Software Description Ontology** (prefix `sd`, published at `w3id.org/okn/o/sd`) is the core ontology of [[okg-soft]], building on OntoSoft and OntoSoft-VFF (source: garijo-etal-escience19.pdf). It is extended by the **Software Description Ontology for Models** (`sdm`, `w3id.org/okn/o/sdm`) with model-specific properties (spatial grids, time intervals, assumptions, equations, processes) (source: garijo-etal-escience19.pdf, MINT-tiis.pdf).

> This ontology is the conceptual model behind the repo's `modelcatalog_*` PostgreSQL schema and the Model Catalog API. See [[model-catalog]].

## Core hierarchy

(source: garijo-etal-escience19.pdf)

- **`sd:Software`** — any piece of software (a package, web service, or configured script).
- **`sd:SoftwareVersion`** — the evolution of a component over time; results can differ across versions.
- **`sd:SoftwareConfiguration`** — a unique executable function/invocation of the software, capturing how it is invoked. Configurations declare inputs (`sd:hasInput`), parameters (`sd:Parameter`), and outputs (`sd:hasOutput`).

The [[mint-platform|MINT]] paper adds a fourth level, **model set up** — a configuration adapted/calibrated to a specific system (see [[model-configuration-and-setup]]). This yields the 4-level hierarchy *Software → Version → Configuration → Setup*.

## Inputs, outputs, and data structure

- **`sd:DatasetSpecification`** — the expected structure of an input/output (file, stream, API, or database), capturing format (`sd:hasFormat`) and the variables it may contain (source: garijo-etal-escience19.pdf).
- **[[variable-presentation|`sd:VariablePresentation`]]** — a variable as it appears in a dataset (label, units, description), linked to an [[scientific-variables-ontology|SVO]] **`sd:StandardVariable`** so differently-named variables ("PREC" vs "P") can be matched by meaning.

## Accessibility

Each ontology version is stored independently in human- and machine-readable form, organized modularly so others can import it. Developers interact via JSON / JSON-LD REST APIs (including a PUT to extend existing entries) or SPARQL (source: garijo-etal-escience19.pdf).

## Related pages

- [[okg-soft]]
- [[model-catalog]]
- [[variable-presentation]]
- [[model-configuration-and-setup]]
- [[scientific-variables-ontology]]
