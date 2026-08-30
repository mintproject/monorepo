# Model Catalog

**Summary**: The MINT catalog of model metadata — software, versions, configurations, and setups — described with semantic web standards and queried to support model discovery and execution.

**Sources**: MINT-tiis.pdf, garijo-etal-escience19.pdf

**Last updated**: 2026-06-06

---

The **Model Catalog** stores all model, model-version, model-configuration, and model-setup metadata using semantic web standards, with links to external resources (GitHub, DockerHub) for code and execution environments (source: MINT-tiis.pdf). It is built on the [[software-description-ontology]] and exposed through the [[okg-soft]] APIs.

> This is the component the surrounding repository implements. Per the project's own notes, the catalog data was migrated from an RDF triplestore (Apache Fuseki) to PostgreSQL + Hasura GraphQL, with tables prefixed `modelcatalog_` following the *Software > Version > Config > Setup* hierarchy described here. See [[semantic-web-standards]] for the RDF lineage.

## What it enables

- **Model discovery** — almost every element of a [[model-configuration-and-setup|model setup tuple]] is metadata that lets MINT match models to the goals of a [[goal-oriented-modeling|modeling task]] (source: MINT-tiis.pdf).
- **Model execution** — adjustable parameters, input file types, and variable→file [[variable-presentation|mappings]] turn a setup into an executable model and drive automated [[data-transformation]] (source: MINT-tiis.pdf).
- **Comparison & understanding** — documentation (authors, assumptions, constraints, usage notes) lets users distinguish and relate many configurations/calibrations of the same model software (source: MINT-tiis.pdf).

## Query examples (OKG-Soft)

The OKG-Soft paper shows SPARQL queries over the catalog (source: garijo-etal-escience19.pdf): basic software description; all versions/configurations and their executable info; inputs and outputs of a configuration; which software produces a variable usable as input to another (the basis of **software composition**). Example variable: the Cycles model's "Tn" maps to the SVO term `air__daily_min_of_temperature`.

## Related pages

- [[software-description-ontology]]
- [[okg-soft]]
- [[model-configuration-and-setup]]
- [[mint-platform]]
- [[semantic-web-standards]]
