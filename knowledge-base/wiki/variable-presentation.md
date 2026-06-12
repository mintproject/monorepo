# Variable Presentation

**Summary**: How a specific variable appears inside a dataset or model file — its label, units, and representation — linked to a standard SVO variable so differently-named variables can be matched.

**Sources**: garijo-etal-escience19.pdf, MINT-tiis.pdf

**Last updated**: 2026-06-06

---

A **variable presentation** (`sd:VariablePresentation` in the [[software-description-ontology]]) captures how a variable is represented in a particular resource: its label, units (`sd:usesUnit`), description, missing-value handling, and collection metadata (source: garijo-etal-escience19.pdf, MINT-tiis.pdf).

The key link is `sd:hasStandardVariable`, which connects the presentation to a unique [[scientific-variables-ontology|SVO]] **standard variable**. This lets the same physical quantity be recognized across software even when each names it differently — e.g., a hydrology model's `PRCP` ("precipitation") presentation links to the SVO term `atmosphere_water__precipitation_leq_volume_flux`; "streamflow" and "discharge" both map to `watershed_outlet_water__volume_flow_rate` (source: garijo-etal-escience19.pdf, MINT-tiis.pdf).

> In the surrounding codebase, `variable_presentation` is a table in the `modelcatalog_*` schema with FK links to StandardVariable and Unit (the "Variable entities" of the migration).

## Why it matters

- **Composition** — relating configurations by the variables they consume/produce enables [[model-catalog|software composition]].
- **Consistency checking** — variable context can detect inconsistencies, e.g., when a presentation's unit dimension does not match the dimension implied by its standard variable (source: garijo-etal-escience19.pdf).
- **Transformation** — presentations carry the units that drive automated [[data-transformation]] and unit conversion via [[qudt|QUDT]].

A dataset resource also has a **layout** describing the physical placement of variables (e.g., which CSV row/column), distinct from the presentation's semantic metadata (source: MINT-tiis.pdf).

## Related pages

- [[software-description-ontology]]
- [[scientific-variables-ontology]]
- [[data-transformation]]
- [[model-configuration-and-setup]]
