# Variable Presentation

**Summary**: How a specific variable appears inside a dataset or model file — its label, units, and representation — linked to a standard SVO variable so differently-named variables can be matched.

**Sources**: garijo-etal-escience19.pdf, MINT-tiis.pdf, SD ontology v1.9.0 (w3id.org/okn/o/sd)

**Last updated**: 2026-06-13

---

A **variable presentation** (`sd:VariablePresentation` in the [[software-description-ontology]]) captures how a variable is represented in a particular resource: its label, units (`sd:usesUnit`), description, missing-value handling, and collection metadata (source: garijo-etal-escience19.pdf, MINT-tiis.pdf).

The key link is `sd:hasStandardVariable`, which connects the presentation to a unique [[scientific-variables-ontology|SVO]] **standard variable**. This lets the same physical quantity be recognized across software even when each names it differently — e.g., a hydrology model's `PRCP` ("precipitation") presentation links to the SVO term `atmosphere_water__precipitation_leq_volume_flux`; "streamflow" and "discharge" both map to `watershed_outlet_water__volume_flow_rate` (source: garijo-etal-escience19.pdf, MINT-tiis.pdf).

> In the surrounding codebase, `variable_presentation` is a table in the `modelcatalog_*` schema with FK links to StandardVariable and Unit (the "Variable entities" of the migration).

## Why it matters

- **Composition** — relating configurations by the variables they consume/produce enables [[model-catalog|software composition]].
- **Consistency checking** — variable context can detect inconsistencies, e.g., when a presentation's unit dimension does not match the dimension implied by its standard variable (source: garijo-etal-escience19.pdf).
- **Transformation** — presentations carry the units that drive automated [[data-transformation]] and unit conversion via [[qudt|QUDT]].

A dataset resource also has a **layout** describing the physical placement of variables (e.g., which CSV row/column), distinct from the presentation's semantic metadata (source: MINT-tiis.pdf).

## Authoritative ontology definitions (SD v1.9.0)

Verified against the published SD ontology TTL at `w3id.org/okn/o/sd` (release 1.9.0). `sd:VariablePresentation` is `rdfs:subClassOf sd:Variable` (source: SD ontology v1.9.0):

> "Concept used to represent an instantiation of a variable in an input/output dataset. For example, a model A may use an input file with temperature expressed in Farenheit (variablePresentation1), while a model B may produce an output with temperature in Celsius (variablePresentation2). Both variable presentations refer to the concept of temperature."

Two naming-layer datatype properties (domain `VariablePresentation`, range `xsd:string`) — both sit *below* the precise SVO standard variable in specificity (source: SD ontology v1.9.0):

- **`sd:hasShortName`** — "A short name (e.g., temperature) capturing the high-level concept of the variable."
- **`sd:hasLongName`** — "Properties that relate the variable representation to its long name. The long name is useful for context (e.g., precipitation is less ambiguous than P) but not as precise as the standard name."

> Caution: `hasShortName` is the *concept-level* label (e.g. `temperature`), not a file column code/symbol. `hasLongName` is a more descriptive/disambiguating label, not merely a "human-readable" variant.

## Realization in the `modelcatalog_*` schema

The migrated `modelcatalog_variable_presentation` table is a **reduced subset** of `sd:VariablePresentation`. ETL maps RDF predicates to columns (source: `etl/extract.py`):

| Column (`TEXT`) | RDF predicate |
|---|---|
| `label` | `rdfs:label` |
| `description` | `sd:description` |
| `has_long_name` | `sd:hasLongName` |
| `has_short_name` | `sd:hasShortName` |

Foreign keys live on this table: `standard_variable_id` → `modelcatalog_standard_variable` (`sd:hasStandardVariable`), `unit_id` → `modelcatalog_unit` (`sd:usesUnit`). The model-catalog-api exposes these camelCased (`hasShortName`, `hasLongName`, `hasStandardVariable`, `usesUnit`). The ontology's missing-value handling, collection metadata, and layout are **not** materialized as columns.

## Related pages

- [[software-description-ontology]]
- [[scientific-variables-ontology]]
- [[data-transformation]]
- [[model-configuration-and-setup]]
