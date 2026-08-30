# CSDMS Standard Names

**Summary**: Cross-domain naming conventions for describing process models, datasets, and their variables; the predecessor and starting point of the Scientific Variables Ontology.

**Sources**: Peckham_and_Stoica_2022_ICWRER_2022.pdf, MINT-tiis.pdf, garijo-etal-escience19.pdf

**Last updated**: 2026-06-06

---

The **CSDMS Standard Names** (CSN) are cross-domain naming conventions for describing process models, datasets, and their associated variables (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf). They were the origin of the [[scientific-variables-ontology]], which "began with the CSDMS Standard Names" (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf). The OKG-Soft paper describes SVO as "an evolved version of the Geoscience Standard Names" (source: garijo-etal-escience19.pdf).

## CSDMS context

CSDMS (Community Surface Dynamics Modeling System) is an open-source community repository of earth-surface-process models with an integrated execution environment; its standard names let variables be shared consistently across models (source: MINT-tiis.pdf). It is associated with the **Basic Model Interface (BMI)**, a standardized, framework-independent model API. The MINT paper notes BMI-style coupling (exchanging variable values while models run) is a different form of integration than MINT's more sequential, data-preparation-focused approach (source: MINT-tiis.pdf).

The CSN and SVO share core conventions, including:

- A large collection of [[mathematical-operations]], with the word "of" used as a serialization delimiter (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf).
- The flux / flow_rate / concentration naming schema for conserved quantities — see [[fluxes-and-flow-rates]].

CSDMS Standard Names are part of the CSDMS (Community Surface Dynamics Modeling System) effort and relate to its component-based approach to integrated modeling in the geosciences (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf, citing Peckham et al. 2013).

## Related pages

- [[scientific-variables-ontology]]
- [[mathematical-operations]]
- [[fluxes-and-flow-rates]]
- [[interoperability]]
- [[mint-platform]]
