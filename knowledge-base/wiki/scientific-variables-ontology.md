# Scientific Variables Ontology (SVO)

**Summary**: A standardized, cross-domain, machine-actionable ontology for describing scientific variable concepts, serving as the interoperability "hub" between models, datasets, and web services.

**Sources**: Peckham_and_Stoica_2022_ICWRER_2022.pdf, stoica-peckham-cwm19.pdf, stoica-peckham_escience19_abstract.pdf, MINT-tiis.pdf, garijo-etal-escience19.pdf

**Last updated**: 2026-06-06

---

The **Scientific Variables Ontology (SVO)** is a formal ontology for describing scientific variables in a complete, unambiguous, machine-actionable way. It began with the [[csdms-standard-names]] and was created by carefully analyzing how variables are used across many scientific models and datasets, distilling general core concepts and principles, then formalizing them using Semantic Web best practices (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf). It was built from iterative analysis of more than 15,000 variables across the natural sciences (source: stoica-peckham-cwm19.pdf).

## Foundational triad

SVO's foundational concepts are **Phenomenon, Property, and Variable**: a well-defined variable must comprise *both* a Phenomenon (object of observation) and a Property (the observable) — neither alone is sufficient (source: stoica-peckham-cwm19.pdf). See [[scientific-variable]]. SVO combines a top-down taxonomy with a lateral relationship architecture for modular composition of complex concepts.

## Purpose

SVO is the **hub** in a hub-and-spoke approach to [[interoperability]]. It provides a representation that is cross-domain, rules-based, human-readable, machine-actionable, unique, and able to disambiguate closely related concepts (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf).

## Scope boundary

SVO describes only the **variable concept** itself — what thing is observed and what property is quantified. It deliberately does **not** capture resource-specific information such as measurement units, method of measurement, or spatial/temporal discretization, since these differ from one digital resource to another. Instead, serialized SVO names can be passed as arguments to functions that return such information for a given resource (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf).

See [[scientific-variable]] for the anatomy of what SVO captures.

## Distinctive feature

SVO is described as the only variable-description system the authors are aware of that also includes most [[mathematical-operations]], recognizing that applying a mathematical operation to a quantity simply produces a new quantity with modified units (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf).

## Applications in MINT

SVO is the variable-description backbone of the [[mint-platform|MINT]] platform and [[okg-soft]]. Model and dataset variables are linked to SVO standard names via [[variable-presentation|variable presentations]], so that differently-named variables ("streamflow" vs "discharge") resolve to one identifier like `watershed_outlet_water__volume_flow_rate` (source: MINT-tiis.pdf, garijo-etal-escience19.pdf). SVO was chosen over SWEET and ENVO because it uses a principled upper ontology and naming patterns to create *unique* identifiers and captures variable context, not just a concept hierarchy (source: MINT-tiis.pdf).

Beyond description, SVO's design patterns support **automated population** of new-domain ontologies and **concept alignment** across resources — see [[svo-automated-population]] (source: stoica-peckham-cwm19.pdf, stoica-peckham_escience19_abstract.pdf). Quantitative Properties carry a unit-dimension string aligned with [[qudt|QUDT]] for conversion.

## Technical basis

Built on W3C [[semantic-web-standards]] (RDF, OWL, SKOS), queryable via SPARQL. Available online at geoscienceontology.org, with permanent URLs planned at w3id.org. Ideas from SVO are being incorporated into the [[i-adopt]] Framework Ontology (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf).

## Related pages

- [[scientific-variable]]
- [[csdms-standard-names]]
- [[property-names]]
- [[process-names]]
- [[mathematical-operations]]
- [[fluxes-and-flow-rates]]
- [[svo-automated-population]]
- [[mint-platform]]
- [[variable-presentation]]
- [[peckham-stoica-2022-svo-core-principles]]
- [[stoica-peckham-2019-svo-blueprint]]
