# QUDT

**Summary**: The Quantities, Units, Dimensions, and Types ontology used in MINT/OKG-Soft for semantic, dimension-aware representation and conversion of measurement units.

**Sources**: garijo-etal-escience19.pdf, MINT-tiis.pdf

**Last updated**: 2026-06-06

---

**QUDT** (Quantities, Units, Dimensions, and Types) is a NASA-originated ontology used extensively in geosciences to represent units of measure (source: garijo-etal-escience19.pdf, MINT-tiis.pdf). MINT and [[okg-soft]] use it so that units carry semantic and dimensional meaning, rather than being opaque text like "m/day".

## Role in the stack

- In OKG-Soft, QUDT is enriched with **CCUT** (Canonicalization Compound Unit representation and Transformation), a custom extension that describes how to perform unit transformations. A unit like "m/day" is decomposed into constituents (meter, day) with their dimensions (length, time) and relationship (L T⁻¹), so units sharing a dimension (e.g., "km/month") can be checked for compatibility (source: garijo-etal-escience19.pdf).
- In MINT's [[data-transformation]] pipeline, CCUT parses textual compound units and maps them to QUDT, then computes the dimension and a normalized representation. Because QUDT relates each unit to base units via numeric factors, conversions within a dimension can be generated automatically — no user-supplied multipliers or offsets (source: MINT-tiis.pdf).

## Relation to SVO

QUDT handles *units and their conversion*, complementing the [[scientific-variables-ontology|SVO]], which describes *variable concepts*. SVO Quantitative Properties carry a unit-dimension string that aligns with QUDT (source: stoica-peckham-cwm19.pdf). The dimension system mirrors the [[international-system-of-quantities]].

## Related pages

- [[data-transformation]]
- [[okg-soft]]
- [[international-system-of-quantities]]
- [[scientific-variables-ontology]]
