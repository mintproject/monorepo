# Goal-Oriented Modeling

**Summary**: MINT's principle of framing modeling around decision goals — organizing work into modeling problems, tasks, and threads defined by drivers, responses, and interventions.

**Sources**: MINT-tiis.pdf

**Last updated**: 2026-06-06

---

**Goal-oriented modeling** casts a user's questions as modeling tasks that capture modeling goals, so that the goals can drive and constrain the choice of models and data (source: MINT-tiis.pdf). It is the first of MINT's four key ideas (see [[mint-platform]]).

## Modeling task

A modeling task is a tuple **MT = ⟨TR, TD, TI, TA, TP⟩** (source: MINT-tiis.pdf):

- **TR — responses**: system outputs relevant to the decision (often output variables or aggregate **indices**), e.g., crop yield, drought index.
- **TD — drivers**: input variables or adjustable parameters that let you study different situations, e.g., rainfall.
- **TI — interventions**: actions that can affect outcomes, incorporated into models through specific drivers, e.g., planting earlier.
- **TA — area**: a geographic region (a polygon), e.g., a river basin.
- **TP — time period**: the run period (often several years, allowing model spin-up).

## Problems, tasks, threads

(source: MINT-tiis.pdf)

- A **modeling problem** is a (non-machine-readable) theme grouping related tasks and aggregating their results.
- A **modeling task** is accomplished through model runs to answer a question of interest.
- A **modeling thread** groups conceptually related model runs — e.g., exploring alternative models, parameters, or input datasets to assess uncertainty.

## Key vocabulary

- **Indicators and indices** — an *indicator* is a quantifiable variable playing a special role in characterizing a system; an *index* combines several indicators into a single value for assessment (e.g., a drought index of 4 = 4 standard deviations from the mean) (source: MINT-tiis.pdf). This echoes the index/indicator idea in [[property-names]].
- **Adjustable parameters** — parameters whose values affect an input variable and can be varied to explore situations.
- **Interventions** — human actions explored through adjustable-parameter and input settings.

A model match: a [[model-configuration-and-setup|model setup]] satisfies a task when its responses, inputs, interventions, area, and time cover the task's TR, TD, TI, TA, TP (source: MINT-tiis.pdf).

## Related pages

- [[mint-platform]]
- [[model-configuration-and-setup]]
- [[provenance]]
- [[property-names]]
