# Stoica & Peckham (2019) — Incorporating New Concepts into SVO

**Summary**: Source summary of the eScience 2019 abstract describing a methodology for automated generation of machine-readable scientific variable concepts using SVO's design patterns.

**Sources**: stoica-peckham_escience19_abstract.pdf

**Last updated**: 2026-06-06

---

"Incorporating New Concepts into the Scientific Variables Ontology" by Maria Stoica and Scott D. Peckham (INSTAAR, CU Boulder), eScience 2019 workshop abstract.

## Contribution

A preliminary methodology for **automated generation** of domain-specific, machine-readable representations of qualitative and quantitative variable concepts, based on the universal categories and modular design patterns of the [[scientific-variables-ontology|SVO]] (v1.0.0) blueprint (source: stoica-peckham_escience19_abstract.pdf). The focus is the **ontology augmentation tools** of the SVO framework — useful when a domain has a long curated variable list (e.g., NWIS SRS codes, CF Standard Names, World Development Indicators) but no ontology.

## Two-component method

(source: stoica-peckham_escience19_abstract.pdf)

1. A **coarse mapper** ingests a freeform string, processes it against the SVO blueprint, and proposes term categorization + a basic variable mapping — enabling bulk processing of long variable lists.
2. A **refinement component** poses clarifying questions to a user to correct bulk-categorization mistakes and fill in missing information.

## Decision-making hierarchy

The tools mimic human concept-learning with a ranked set of guidelines: (1) trust information already in the ontology over external sources; (2) leverage crowd-sourced/expert linked data; (3) prefer short precise definitions; (4) use part-of-speech analysis to assign roles; (5) use n-gram language indexes for disambiguation; (6) use machine learning trained on verified ontology content (source: stoica-peckham_escience19_abstract.pdf).

## Preliminary result

Blindly mapping SVO classes to the **WordNet** hierarchy (which has categories like process, phenomenon, attribute, state) gave high accuracy for most classes — Process 1250/1502 correct — but struggled with **complex/dynamic phenomena** (source: stoica-peckham_escience19_abstract.pdf).

This work is detailed further in [[svo-automated-population]].

## Related pages

- [[scientific-variables-ontology]]
- [[svo-automated-population]]
- [[stoica-peckham-2019-svo-blueprint]]
