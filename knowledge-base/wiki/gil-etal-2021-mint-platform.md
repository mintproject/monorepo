# Gil et al. — Artificial Intelligence for Modeling Complex Systems (MINT)

**Summary**: Source summary of the flagship MINT journal paper (ACM TIIS), describing an AI-powered framework that reduces the effort of integrating expert models across disciplines for decision making.

**Sources**: MINT-tiis.pdf

**Last updated**: 2026-06-06

---

"Artificial Intelligence for Modeling Complex Systems: Taming the Complexity of Expert Models to Improve Decision Making" by Yolanda Gil, Daniel Garijo, Deborah Khider, Craig Knoblock, Varun Ratnakar, **Maximiliano Osorio**, and a large multi-institution team (USC/ISI, U. Minnesota, TACC, Penn State, CU Boulder, Virginia Tech, UC Davis). Published in ACM Transactions on Interactive Intelligent Systems.

## Problem

Major societal/environmental challenges (droughts, floods, crop production, water availability) require integrating expert models across climate, hydrology, agriculture, and economics. Today this integration is largely manual and can take **more than two years**, due to semantic, spatio-temporal, and execution mismatches between models and data (source: MINT-tiis.pdf).

## Four contributions

(source: MINT-tiis.pdf)

1. **[[goal-oriented-modeling]]** — encapsulate model software around decision questions and interventions.
2. **Modeling as problem solving** — modeling goals drive selection of models and their [[model-configuration-and-setup|configurations and setups]].
3. **Representing and transforming data** — semantic dataset representation enabling automated selection and transformation (see [[data-transformation]]).
4. **Interactive scenario exploration** — a UI that guides users through modeling stages, visualizes results, and records [[provenance]].

## Implementation

Implemented in the **[[mint-platform|MINT (Model INTegration) framework]]**, with real models (PIHM, TopoFlow, Cycles, HAND, MODFLOW) and data for two testbeds: Sub-Saharan Africa (Ethiopia, South Sudan) and the South-Central US (Texas / Planet Texas 2050). The Sub-Saharan testbed alone reached 26 model configurations, 95 setups, 297 datasets (2.46M resources), and 33,412 model runs (3.1 TB of outputs) (source: MINT-tiis.pdf).

Models and metadata are described in a [[model-catalog]] using the [[software-description-ontology]]; variables use [[scientific-variables-ontology|SVO]]; units use [[qudt|QUDT]]. Funded by DARPA (W911NF-18-1-0027), Planet Texas 2050, and NSF (ICER-1440323) (source: MINT-tiis.pdf).

## Related pages

- [[mint-platform]]
- [[goal-oriented-modeling]]
- [[model-configuration-and-setup]]
- [[data-transformation]]
- [[okg-soft]]
