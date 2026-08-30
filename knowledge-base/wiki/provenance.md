# Provenance

**Summary**: Records of what models, versions, data, and parameters produced each model result — the basis for explanation, drill-down, and reproducibility in MINT.

**Sources**: MINT-tiis.pdf

**Last updated**: 2026-06-06

---

**Provenance** accompanies every MINT model run, recording the model and software version used and all parameter values for each run (source: MINT-tiis.pdf). Because provenance records reference all setups, data, and parameters, they can supply whatever is needed to explain a data product.

## Uses

(source: MINT-tiis.pdf)

- **Explanation** — provenance records serve as the basis for explaining and presenting model products; a user can browse a provenance report and **drill down** to examine alternatives and the reasons for a selection.
- **Reproducibility** — runs can be re-executed with different initial conditions, or re-run later when forecasts change.
- **Interactive reporting** — treating provenance as a drill-down/revisit/re-run mechanism is central to building interactive reports for decision making.

Provenance is exposed through MINT's **provenance catalog**, distinct from the raw-data catalog — a separation that the paper's user evaluation found could confuse users searching for model outputs vs. raw data (source: MINT-tiis.pdf).

## Related pages

- [[mint-platform]]
- [[goal-oriented-modeling]]
- [[model-configuration-and-setup]]
