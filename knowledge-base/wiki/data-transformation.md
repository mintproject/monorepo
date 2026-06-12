# Data Transformation

**Summary**: MINT's pipeline for representing heterogeneous datasets and automatically transforming them into model-ready formats — using D-REPR, D-TRAN, table understanding, and CCUT/QUDT unit handling.

**Sources**: MINT-tiis.pdf

**Last updated**: 2026-06-06

---

A major barrier to integrated modeling is **data friction**: datasets arrive in different formats, layouts, grids, resolutions, units, projections, and vocabularies, and reconciling them is largely manual (source: MINT-tiis.pdf). MINT addresses this with semantic representations that enable automated discovery and transformation, mapping data to a common RDF model using [[scientific-variables-ontology|SVO]] and the RDF Data Cube.

## Dataset model

A **dataset** is a logical grouping of data about specific variables across one or more resources, sharing geospatial/temporal extent and provenance. Each variable links to SVO names and has a [[variable-presentation]] (units, missing-value handling, collection metadata); each resource has a **layout** describing physical relationships between variables (source: MINT-tiis.pdf). Fuzzy keyword augmentation (WordNet, DBpedia, ConceptNet, word embeddings, web queries; filtered with TF-IDF) supports data discovery.

## D-REPR

**D-REPR** is a language for describing diversely-structured datasets in four steps: specify format → define attributes and their locations → join attribute arrays into tables → assign semantic meaning via ontology classes/predicates (source: MINT-tiis.pdf). It handles many formats/layouts and can **virtually** map gigantic datasets to RDF (e.g., the GLDAS netCDF weather dataset) at near-native speed.

## Automatic table understanding

To reduce the effort of writing D-REPR, the MINT Data Catalog auto-profiles tabular datasets in three stages (source: MINT-tiis.pdf): **cell classification** (label each cell syntactically/semantically, via probabilistic graphical models) → **block identification** (entropy-based grouping of similar cells) → **layout detection** (link prediction of join relationships between blocks). Users can review and correct each stage.

## D-TRAN

**D-TRAN** builds transformation pipelines from reusable **adapters** (source: MINT-tiis.pdf):

- **Reader adapters** read input files + their D-REPR into the internal D-TRAN format.
- **Transformation adapters** operate only on D-TRAN format (so they generalize across data formats) — e.g., cropping, aggregation, regridding.
- **Writer adapters** materialize D-TRAN back to files per a target D-REPR.

Example: convert global daily GPM netCDF4 + admin shapefiles into monthly per-district precipitation CSV.

## Units: CCUT + QUDT

**CCUT** parses textual compound units (prefixes, units, exponents, multipliers), maps them to the [[qudt|QUDT]] ontology, and computes dimensions — enabling safe automated unit conversion within a dimension without user-supplied factors (source: MINT-tiis.pdf).

## Novel data from remote sensing

When ground observations are scarce, MINT derives calibration data from satellite imagery — e.g., estimating river surface extent (a discharge proxy) with deep CNNs and physics-guided ML (auto-encoder features, U-Net segmentation, hydraulic/bathymetric constraints) (source: MINT-tiis.pdf).

## Related pages

- [[variable-presentation]]
- [[qudt]]
- [[scientific-variables-ontology]]
- [[mint-platform]]
