# Interoperability

**Summary**: The ability of digital resources to exchange and use each other's data; addressed at scale via a hub-and-spoke architecture with a shared variable representation.

**Sources**: Peckham_and_Stoica_2022_ICWRER_2022.pdf, MINT-tiis.pdf, garijo-etal-escience19.pdf

**Last updated**: 2026-06-06

---

Because the values of [[scientific-variable|scientific variables]] are the **exchange items** passed between digital resources — numerical models, datasets, and web services — variables are central to the problem of **interoperability** (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf).

Interoperability is the "I" in [[fair-principles|FAIR]], but it tends to receive less attention than the other three letters (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf).

## Hub-and-spoke approach

To tackle interoperability in a general way, computer science indicates that a **hub-and-spoke** approach is the most practical and scalable option. This requires a standardized, very expressive representation of scientific variable concepts (the *hub*) that is cross-domain, rules-based, human-readable, machine-actionable, unique, and able to disambiguate closely related concepts (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf).

The [[scientific-variables-ontology]] was created to serve as this hub. It grew from the [[csdms-standard-names]], itself part of a component-based approach to integrated modeling in the geosciences (source: Peckham_and_Stoica_2022_ICWRER_2022.pdf, citing Peckham et al. 2013).

## Interoperability in MINT

The [[mint-platform|MINT]] platform tackles interoperability at three levels (source: MINT-tiis.pdf, garijo-etal-escience19.pdf):

- **Variable interoperability** — SVO standard names mediate between differently-named model/data variables (via [[variable-presentation|variable presentations]]).
- **Data interoperability** — heterogeneous formats/layouts are mapped to a common RDF model and transformed automatically (see [[data-transformation]]).
- **Software interoperability** — [[okg-soft]] publishes machine-readable software metadata so components can be discovered and composed.

Mismatches between models are reconciled by **mediators** (regridding, resampling, unit conversion, reprojection) — combining the adapter and mediator design patterns; mediators offered as web services are **brokers** (source: MINT-tiis.pdf).

## Related pages

- [[fair-principles]]
- [[scientific-variables-ontology]]
- [[csdms-standard-names]]
- [[scientific-variable]]
- [[mint-platform]]
- [[okg-soft]]
- [[data-transformation]]
- [[linked-data]]
