# Peckham & Stoica (2022) — Core Principles of the Scientific Variables Ontology

**Summary**: Source summary of an ICWRER 2022 extended abstract giving a high-level overview of the key concepts and design principles behind the Scientific Variables Ontology (SVO).

**Sources**: Peckham_and_Stoica_2022_ICWRER_2022.pdf

**Last updated**: 2026-06-06

---

A 5-page extended abstract by Scott D. Peckham and Maria Stoica (INSTAAR, University of Colorado, Boulder), presented at ICWRER 2022. It motivates and summarizes the [[scientific-variables-ontology]] (SVO).

## Motivation

Variables underpin scientific research: we measure their values, store them in datasets, relate them in equations, and use them to drive computational models (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf). Because variable values are the *exchange items* passed between digital resources (numerical models, datasets, web services), variables are central to the problem of [[interoperability]] — the under-served "I" of the [[fair-principles]] (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf).

To solve interoperability at scale, the paper argues for a **hub-and-spoke** approach requiring one standardized, very expressive variable representation that is cross-domain, rules-based, human-readable, machine-actionable, unique, and able to disambiguate closely related concepts (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf). SVO, which began with the [[csdms-standard-names]], was created to fill this need.

## Topics covered

The abstract walks through the core building blocks of describing a [[scientific-variable]]:

- **Terminology** — object/phenomenon, event, property, value
- **[[property-names]]** — quantitative vs. qualitative; the Property Name Rule
- **[[international-system-of-quantities]]** — the physics-based basis for quantities
- **[[process-names]]** — the Process Name Rule and process quantities
- **[[mathematical-operations]]** — operations that transform quantities
- **[[fluxes-and-flow-rates]]** — naming schema for conserved quantities

## Technical foundation

SVO is formalized using W3C [[semantic-web-standards]] (RDF, OWL, SKOS), queryable via SPARQL, with permanent URLs planned at w3id.org. Its ideas are being incorporated into the [[i-adopt]] Framework Ontology (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf).

## Funding

Funded by NSF EarthCube and the DARPA World Modelers program (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf).

## Related pages

- [[scientific-variables-ontology]]
- [[scientific-variable]]
- [[csdms-standard-names]]
- [[interoperability]]
