# Fluxes and Flow Rates

**Summary**: A logically consistent naming schema for flow-related quantities, built on the 7 conserved "root quantities" of physics and standard suffixes like flux, flow_rate, and concentration.

**Sources**: Peckham_and_Stoica_2022_ICWRER_2022.pdf

**Last updated**: 2026-06-06

---

In physics there are **7 main conserved "root quantities"** used across the geosciences in models and datasets (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf):

- charge [C]
- energy [J]
- mass [kg]
- moles [mol]
- momentum [kg m s⁻¹]
- number [1]
- volume [m³]

Let **X** be any of these (with units U). SVO defines an associated family of quantities (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf):

| Quantity name | Change to units | Field type |
|---|---|---|
| X_flux | U L⁻² T⁻¹ | vector |
| X_flow_rate | U T⁻¹ | scalar |
| X_concentration | U L⁻³ | scalar |
| X_fraction | U/U | scalar |
| X_ratio | U/U | scalar |
| X_diffusivity | L² T⁻¹ | scalar |
| divergence_of_X_flux | U L⁻³ T⁻¹ | scalar |
| z_integral_of_X_flux | U L⁻¹ T⁻¹ | vector ("unit-width") |
| gradient_of_X_concentration | U L⁻⁴ | vector |
| z_integral_of_X_concentration | U L⁻² | scalar ("content") |

Key conventions (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf):

- A **flux** is a vector that adds "per unit area per unit time" to base units.
- The suffix **rate** adds "per unit time".
- A **flow rate** can be defined as the area integral of the normal component of a flux.

## Discipline-specific terms

The schema is nearly self-defining, but disciplines often use different terms. In electricity: *electric current density* (vs. charge flux), *electric current* (vs. charge flow rate), *volume charge density* (vs. charge concentration) (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf).

The imprecise "rainfall rate" can be a **volume flux** (e.g., mm/hr) or a **mass flux** (e.g., kg m⁻² s⁻¹). Meteorologists prefer mass flux because, unlike volume flux, it does not depend on precipitation density, which varies dramatically across rain, snow, sleet, hail, and graupel (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf).

## Related pages

- [[mathematical-operations]]
- [[international-system-of-quantities]]
- [[csdms-standard-names]]
- [[scientific-variables-ontology]]
