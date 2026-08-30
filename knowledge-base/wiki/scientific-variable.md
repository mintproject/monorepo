# Scientific Variable

**Summary**: The core unit described by SVO — defined minimally by what object/phenomenon is observed and what property of it is quantified, plus optional context, operations, and a value.

**Sources**: Peckham_and_Stoica_2022_ICWRER_2022.pdf, stoica-peckham-cwm19.pdf

**Last updated**: 2026-06-13

---

A **scientific variable** is not well-defined until we know at minimum (1) what "thing" was observed, and (2) what property of that thing is being quantified (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf). Variables can also involve other concepts like physical processes, units, and mathematical operations.

## The Phenomenon–Property–Variable triad

The blueprint paper states the **core principle** formally: a well-defined Variable must comprise *both* a **Phenomenon** (the object of observation) and a **Property** (the observable aspect chosen to record); neither alone is sufficient (source: stoica-peckham-cwm19.pdf). In common speech people name variables with just a property ("temperature") or just an object ("carbon-dioxide"), but to automate linking of data and models both are required — e.g., "air temperature" (air + temperature), "car price" (car + price). For a variable to be useful, the values its property can take should be standardized, qualitatively or quantitatively.

For complex variables, SVO composes elementary concepts modularly — identifying processes, assigning Phenomena to **Roles** within larger compound Phenomena, labeling reference frames, and adding spatio-temporal context (source: stoica-peckham-cwm19.pdf).

## Object / phenomenon

The thing being observed is referred to as an **object** or a **phenomenon**. A phenomenon is "something that can occur"; an **event** is an instance of a phenomenon occurring within a specific range of time and space, often given a name. Example: a hurricane is a phenomenon, while Hurricane Maria was an event (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf).

Adjectives are often needed to fully prescribe the object/phenomenon (e.g., "dissolved" and "organic" in "dissolved organic carbon"). Additional context may be required, such as containment within a **medium** (air, water, soil), a larger parent object, or comparison to a theoretical/reference concept. SVO has a general set of classes for providing this context (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf).

## Property

The next essential aspect is the **property** being observed or measured. Properties can be quantitative (quantities) or qualitative (often quantified with an index). They can describe either the **state** of an object/phenomenon or an aspect of some **process** it participates in. Again, adjectives are often needed for disambiguation — e.g., thermodynamics distinguishes mass-specific, mole-specific, volume-specific, isobaric, isochoric, and isothermal "heat capacity" (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf). See [[property-names]].

## Value

The **value** is the number associated with a variable (via some method of measurement or estimation and specific units). SVO's goal is only to describe the variable concept, not the value — see the scope boundary in [[scientific-variables-ontology]]. Some variables have a definite value that cannot be measured directly (e.g., the mass of Earth's Moon, the number of carbon atoms in a coffee cup) (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf).

## Units vs. dimensions — does a scientific variable "support units"?

A scientific variable (the SVO **standard variable**) does **not** carry actual measurement units. SVO explicitly excludes them as resource-specific:

> "our goal is only to fully describe the variable concept. When this concept is utilized in some digital resource, there will also be measurement units, a method of measurement, and typically some type of discretization in space and/or time. SVO does not attempt to capture this related information, which may differ from one resource to another." (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf)

What it *does* carry is a **dimension** — the paper calls it "generic units." A Quantitative Property is grounded in the ISQ / ISO 80000 ([[international-system-of-quantities]]) dimension formula `Lᵃ Mᵇ Tᶜ Iᵈ Θᵉ Nᶠ Jᵍ` (e.g. velocity `[L T⁻¹]`, pressure `[L⁻¹ M T⁻²]`). This is a dimension string, not a concrete unit like `m/s` (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf). The dimension string aligns with [[qudt|QUDT]] (source: stoica-peckham-cwm19.pdf).

The actual unit attaches one level down, on the [[variable-presentation]] via `sd:usesUnit`. Keeping the dimension on the variable and the concrete unit on the presentation enables **consistency checking**: MINT can flag when a presentation's unit dimension disagrees with the dimension implied by its standard variable.

This is faithfully reflected in the `modelcatalog_*` schema — `modelcatalog_standard_variable` exposes only `id`, `label`, `description`, `same_as` (no unit column or unit FK); the unit FK (`unit_id` / `usesUnit`) lives only on `modelcatalog_variable_presentation`.

## Related pages

- [[scientific-variables-ontology]]
- [[property-names]]
- [[process-names]]
- [[mathematical-operations]]
- [[svo-automated-population]]
- [[variable-presentation]]
- [[stoica-peckham-2019-svo-blueprint]]
