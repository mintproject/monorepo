# Stoica & Peckham (2019) — The SVO Blueprint

**Summary**: Source summary of the Modeling the World's Systems 2019 paper describing SVO as a blueprint for creating and aligning machine-interpretable variable concepts.

**Sources**: stoica-peckham-cwm19.pdf

**Last updated**: 2026-06-06

---

"The Scientific Variables Ontology: A Blueprint for Custom Manual and Automated Creation and Alignment of Machine-Interpretable Qualitative and Quantitative Variable Concepts" by Maria Stoica and Scott D. Peckham (INSTAAR, CU Boulder), Modeling the World's Systems Conference, 2019.

## Foundational concepts

The [[scientific-variables-ontology|SVO]] is an ontology **blueprint** built from iterative analysis of **more than 15,000 variables** across the natural sciences (source: stoica-peckham-cwm19.pdf). Its three foundational concepts are **Phenomenon, Property, and Variable**:

- A **Phenomenon** is anything that is or can be observed to exist or happen — the object of an observation (loosely from Kant's noumena/phenomena distinction).
- A **Property** is the observable aspect of a phenomenon one chooses to record.
- The **core principle**: a well-defined **Variable** must comprise *both* a Phenomenon and a Property — neither alone suffices. E.g., "air temperature" (air + temperature), "car price" (car + price) (source: stoica-peckham-cwm19.pdf).

See [[scientific-variable]] for how this maps to SVO's variable anatomy.

## Structure

SVO has a **top-down taxonomy** (hierarchy of variable component concepts) and a **lateral relationship architecture** that allows modular mix-and-match composition of atomic elements into complex concepts — including processes, **Roles** within compound phenomena, reference frames, and spatio-temporal context (source: stoica-peckham-cwm19.pdf). It includes a **standard-name generator** that serializes concepts into human-readable strings using the [[csdms-standard-names|CSDMS]] controlled vocabulary.

## Two applications

(source: stoica-peckham-cwm19.pdf)

1. **Ontology-guided concept creation** — populating new-domain variable ontologies via word morphology + part-of-speech tagging and linked-data sources (WordNet, Wiktionary, Wikidata). Common patterns: *Phenomenon + Process* and *Process + of + Phenomenon*. See [[svo-automated-population]].
2. **Ontology-guided concept alignment** — reasoning over the SVO structure to align terms across data and models with high *explainability* (e.g., soil moisture → `soil water volume fraction`; drought → `atmosphere water rainfall volume flux`). Quantitative Properties carry a unit-dimension string aligned with [[qudt|QUDT]] for unit conversion, and **Operators** apply [[mathematical-operations]] to quantities.

Funded by DARPA MINT (W911NF-18-1-0027) and NSF BALTO (1740696).

## Related pages

- [[scientific-variables-ontology]]
- [[scientific-variable]]
- [[svo-automated-population]]
- [[mathematical-operations]]
