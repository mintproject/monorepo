# Wiki Log

Append-only record of all operations on the wiki.

Format: `YYYY-MM-DD -- <source or action> -- <what changed>`

---

<!-- Example entries:
2026-01-15 -- raw/paper.pdf -- created [[paper-summary]], updated [[concept-a]], [[concept-b]]
2026-01-16 -- lint -- found 2 orphan pages, fixed broken link in [[concept-a]]
-->

2026-06-06 -- raw/Peckham_and_Stoica_2022_ICWRER_2022.pdf -- created source summary [[peckham-stoica-2022-svo-core-principles]] and 12 concept pages: [[scientific-variables-ontology]], [[scientific-variable]], [[csdms-standard-names]], [[property-names]], [[international-system-of-quantities]], [[process-names]], [[mathematical-operations]], [[fluxes-and-flow-rates]], [[interoperability]], [[fair-principles]], [[semantic-web-standards]], [[i-adopt]]; rebuilt [[index]]

2026-06-06 -- raw/MINT-tiis.pdf, raw/garijo-etal-escience19.pdf, raw/stoica-peckham-cwm19.pdf, raw/stoica-peckham_escience19_abstract.pdf -- created 4 source summaries [[gil-etal-2021-mint-platform]], [[garijo-etal-2019-okg-soft]], [[stoica-peckham-2019-svo-blueprint]], [[stoica-peckham-2019-svo-augmentation]] and 11 concept pages: [[mint-platform]], [[okg-soft]], [[software-description-ontology]], [[model-catalog]], [[goal-oriented-modeling]], [[model-configuration-and-setup]], [[data-transformation]], [[qudt]], [[variable-presentation]], [[provenance]], [[linked-data]], [[svo-automated-population]]; updated [[scientific-variables-ontology]], [[scientific-variable]], [[csdms-standard-names]], [[interoperability]], [[fair-principles]], [[semantic-web-standards]]; rebuilt [[index]]

2026-06-13 -- SD ontology v1.9.0 (w3id.org/okn/o/sd, ontology.ttl) -- updated [[variable-presentation]] with authoritative rdfs:comment definitions for sd:VariablePresentation (subClassOf sd:Variable), sd:hasShortName, sd:hasLongName; corrected prior guess that hasShortName meant a file column code/symbol; documented modelcatalog_variable_presentation column-to-predicate mapping (source: etl/extract.py); updated [[index]]

2026-06-13 -- raw/Peckham_and_Stoica_2022_ICWRER_2022.pdf, raw/stoica-peckham-cwm19.pdf -- updated [[scientific-variable]] with a "Units vs. dimensions" section answering whether a standard variable supports units: SVO carries an ISQ/ISO 80000 dimension ("generic units"), not actual measurement units; concrete unit attaches on [[variable-presentation]] via sd:usesUnit; confirmed modelcatalog_standard_variable has no unit column/FK; updated [[index]]
