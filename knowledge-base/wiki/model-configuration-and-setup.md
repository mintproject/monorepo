# Model Configuration and Setup

**Summary**: The two lowest levels of MINT's model hierarchy — a configuration fixes which processes/inputs a model uses; a setup adapts a configuration (often via calibration) to a specific region and time.

**Sources**: MINT-tiis.pdf

**Last updated**: 2026-06-06

---

To turn an expert model's software package into a reusable problem-solving component, MINT creates configurations and then setups (source: MINT-tiis.pdf). These are the bottom two levels of the *Software → Version → Configuration → Setup* hierarchy in the [[software-description-ontology]].

## Model configuration

A **model configuration** is a specific invocation function of model software that includes certain processes and variables while excluding others (source: MINT-tiis.pdf). Example: a hydrology-model configuration for arid regions that omits snowmelt processes.

## Model setup

A **model setup** adapts a generic configuration to a specific system, with parameters adjusted to that system based on historical observations (model **calibration** / parameterization, automated or manual) (source: MINT-tiis.pdf). Example: a setup of a hydrology model calibrated for a specific river basin.

Formally, a setup is a tuple **MS = ⟨SC, SE, SA, SF, SP, SI, SO, SM, SN, SR, SS, ST⟩** (source: MINT-tiis.pdf):

| Element | Meaning |
|---|---|
| SC | pre-selected input file types (incl. config files) |
| SE | pre-selected parameter values |
| SA | adjustable parameters exposed, each with a valid range |
| SF | input file types still to be provided |
| SP | output file types produced |
| SI / SO | input / output variables (associated with SF / SP) |
| SM | mappings of SI, SO, SA into SF and SP |
| SN / SR | interventions / responses associated with SI / SO |
| SS | area (polygon) where the setup is appropriate |
| ST | time period when the model can be run |

## Matching tasks and execution

A setup MS **matches** a [[goal-oriented-modeling|modeling task]] MT = ⟨TR, TD, TI, TA, TP⟩ iff TR⊆SR, TD⊆SI, TI⊆SN, TA is contained in SS, and TP contains ST (source: MINT-tiis.pdf). To run, a user supplies a **set-up assignment** binding all SF files and SA parameters; many assignments form a **model ensemble**.

## Adjustable parameter

An adjustable parameter is a tuple **AP = ⟨PE, PU, PV, PD, PT, PM⟩**: explanation, units, value range, default, type, and the model variables it affects (source: MINT-tiis.pdf). Parameters are tied to interventions (e.g., weed-fraction parameter ↔ weed-management intervention).

## Related pages

- [[goal-oriented-modeling]]
- [[software-description-ontology]]
- [[model-catalog]]
- [[mint-platform]]
- [[variable-presentation]]
