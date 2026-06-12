# MINT Platform

**Summary**: The Model INTegration framework — an AI-powered system that helps users find, configure, run, and combine expert models across disciplines for decision making.

**Sources**: MINT-tiis.pdf, garijo-etal-escience19.pdf

**Last updated**: 2026-06-06

---

**MINT (Model INTegration)** is a modeling framework that uses AI techniques to reduce the effort of integrating expert models with third-party data and across disciplines, while keeping results useful for decision making (source: MINT-tiis.pdf). It targets the interaction of natural and human systems — climate, water availability, agriculture, and markets.

> This is the platform the surrounding codebase implements. Concepts here map directly to the repo: the [[model-catalog]] (`modelcatalog_*` tables), model configurations/setups, and the ensemble execution manager.

## Approach

MINT rests on four key ideas (source: MINT-tiis.pdf):

1. **[[goal-oriented-modeling]]** — frame questions as modeling tasks with drivers, responses, and interventions.
2. **Modeling as problem solving** — modeling goals constrain the selection of models and their [[model-configuration-and-setup|configurations and setups]].
3. **Representing and transforming data** — semantic metadata enables data discovery and automated [[data-transformation]].
4. **Interactive scenario exploration** — a UI guides users through modeling stages and records [[provenance]].

## User roles

MINT distinguishes users by skill (source: MINT-tiis.pdf): **modeler** (runs pre-prepared models), **analyst** (frames problems, builds reports), **decision maker** (browses reports, drills into causality). Two populating roles: **expert modeler** (adds model configurations/setups) and **data specialist** (curates datasets).

## Modeling workflow

The UI guides users through: formulate objectives → select models → select datasets → set up models → monitor runs → view results → visualize (source: MINT-tiis.pdf). Each model run is a [[model-configuration-and-setup|setup]] plus a set-up assignment; many runs form a **model ensemble**.

## Architecture & software

Components include the user interface, data services, model services, execution services, and catalogs. Model metadata lives in a [[model-catalog]] built on the [[software-description-ontology]] for Models (`sdm:`); variables use [[scientific-variables-ontology|SVO]]; units use [[qudt|QUDT]]; software metadata is published via [[okg-soft]] (source: MINT-tiis.pdf, garijo-etal-escience19.pdf). Models in use include PIHM, TopoFlow, Cycles, HAND, and MODFLOW.

## Related pages

- [[goal-oriented-modeling]]
- [[model-catalog]]
- [[model-configuration-and-setup]]
- [[data-transformation]]
- [[okg-soft]]
- [[gil-etal-2021-mint-platform]]
