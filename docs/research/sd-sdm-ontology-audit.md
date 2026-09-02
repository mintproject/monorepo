# Audit of the published `sd` / `sdm` ontology

**Ticket:** [#217](https://github.com/mintproject/monorepo/issues/217) — research, under map [#214](https://github.com/mintproject/monorepo/issues/214)
**Measured:** 2026-09-02
**Sources fetched:** `https://w3id.org/okn/o/sd`, `https://w3id.org/okn/o/sdm` (live), parsed with rdflib 7.6.0.

---

## Answer first

1. **Every `typeUri` in `resource-registry.ts` is defined.** 47 occurrences, 46 distinct IRIs, 46 of 46 found. Nothing is missing.
2. **Two ETL predicates are not defined:** `sd:hasDimension` (wrong prefix — the term is `sdm:hasDimension`) and `sdm:gridType` (does not exist in any release).
3. **The casing claim is confirmed.** The ontology says `sd:hasDownloadURL`. The API response mapper emits `hasDownloadUrl`. The OpenAPI spec says `hasDownloadURL`. Three layers, two spellings.
4. **`w3id.org` already does exactly what map #214 wants.** `Accept` drives a 303 to a format-specific file. An unsatisfiable `Accept` returns **406**. `*/*` returns RDF/XML.
5. **`w3id.org/okn/o/sdm` serves a stale release.** It redirects to **1.7.0**; **1.8.0** is published and reachable. `sd` correctly serves its newest, **1.9.0**.

---

## 1. Content negotiation on the `w3id.org` URIs

This is the most transferable part of the audit: a live, working implementation of the behaviour map #214 is specifying.

### 1.1 The redirect chain

Every request takes **three hops**:

```
GET https://w3id.org/okn/o/sd            Accept: <type>
  -> 301 Moved Permanently   Location: https://w3id.org/okn/o/sd/        (trailing slash)
  -> 303 See Other           Location: <format-specific file on GitHub Pages>
  -> 200 OK                  Content-Type: <the negotiated type>
```

Hops 1 and 2 are served by `Apache/2.4.58 (Ubuntu)` at `w3id.org`. Hop 3 is GitHub Pages behind Fastly.
Both redirect responses carry `Access-Control-Allow-Origin: *` and `Strict-Transport-Security: max-age=15768000`, and both have a `Content-Type: text/html` body of 50 bytes that no client ever reads.

The **303 See Other**, not a 302, is the deliberate linked-data choice: the ontology (an abstract thing) is not the document, so the server redirects to a *representation of* it. This is the httpRange-14 convention.

### 1.2 `sd` — transcript

Command: `curl -sIL -H 'Accept: <type>' https://w3id.org/okn/o/sd`

| `Accept` | 303 target | Final `Content-Type` | Bytes |
|---|---|---|---|
| `text/turtle` | `…/SoftwareDescriptionOntology/release/1.9.0/ontology.ttl` | `text/turtle; charset=utf-8` | 67311 |
| `application/rdf+xml` | `…/release/1.9.0/ontology.owl` | `application/rdf+xml` | 93162 |
| `application/ld+json` | `…/release/1.9.0/ontology.json` | `application/json; charset=utf-8` | 107612 |
| `text/html` | `…/release/1.9.0/index-en.html` | `text/html; charset=utf-8` | 6011 |
| `*/*` | `…/release/1.9.0/ontology.owl` | `application/rdf+xml` | 93162 |
| `application/x-nonexistent` | — | **406 Not Acceptable** (`text/html; charset=iso-8859-1`) | — |

Host prefix elided above: `https://knowledgecaptureanddiscovery.github.io`.

### 1.3 `sdm` — transcript

| `Accept` | 303 target | Final `Content-Type` | Bytes |
|---|---|---|---|
| `text/turtle` | `…/Mint-ModelCatalog-Ontology/release/1.7.0/ontology.ttl` | `text/turtle; charset=utf-8` | 26993 |
| `application/rdf+xml` | `…/release/1.7.0/ontology.owl` | `application/rdf+xml` | 37485 |
| `application/ld+json` | `…/release/1.7.0/ontology.json` | `application/json; charset=utf-8` | 42539 |
| `text/html` | `…/release/1.7.0/index-en.html` | `text/html; charset=utf-8` | 6172 |
| `*/*` | `…/release/1.7.0/ontology.owl` | `application/rdf+xml` | 37485 |

Host prefix elided: `https://mintproject.github.io`.

### 1.4 Six observations that bear on map #214

1. **`*/*` does not return HTML.** A plain browser navigating to `https://w3id.org/okn/o/sd` gets RDF/XML, not the documentation page. The HTML page needs an explicit `Accept: text/html`. This is the mirror image of decision 4 in the map (`*/*` returns JSON): both pick a machine format as the default, not the human one. It is a defensible choice and it has been live for years.
2. **An unsatisfiable `Accept` returns 406.** Decision 4 of the map matches deployed practice exactly. The 406 body is Apache's stock error page, not a structured error.
3. **`application/ld+json` is answered with `Content-Type: application/json`, not `application/ld+json`.** GitHub Pages types the file by its `.json` extension; the 303 target is chosen correctly but the final content type is wrong. If the catalog ever adds JSON-LD (map: "not yet specified"), it must set the type itself — do not learn this bug from the example.
4. **The negotiation happens at the redirect, not at the payload.** `w3id.org` never serves a byte of RDF. It only chooses a URL. That is a cheap pattern the catalog cannot copy: `model-catalog-api` has no static per-format artefacts to redirect to and must serialize in-process.
5. **No `Vary: Accept` on the redirects.** The 301 and 303 responses do not declare `Vary`, so a shared cache may serve one client's negotiated redirect to another client with a different `Accept`. **The catalog must send `Vary: Accept` on every negotiated response.** This is a defect in the example, not a feature to copy.
6. **`ETag` and `Last-Modified` come free on hop 3** (`etag: "679cc9b2-106ef"`, `last-modified: Fri, 31 Jan 2025 13:01:38 GMT`). The map lists caching as "not yet specified"; the example shows a strong validator per representation, which is the right shape.

### 1.5 The instance namespace is dead — the reason this map exists

```
GET https://w3id.org/okn/i/mint/   Accept: text/turtle
  -> 302 Found   Location: https://rdfexplorer.mint.isi.edu/okn/i/mint/
  -> 502 Bad Gateway
```

Note the **302, not 303**, and the dead upstream. Every `https://w3id.org/okn/i/mint/...` id stored as a primary key in `modelcatalog_*` currently resolves to a 502. This is the concrete failure ADR-0001 predicted and that map #214 sets out to repair.

---

## 2. Ontology version and publication date

| | `sd` | `sdm` |
|---|---|---|
| Ontology IRI | `https://w3id.org/okn/o/sd` | `https://w3id.org/okn/o/sdm` |
| `owl:versionIRI` served | `https://w3id.org/okn/o/sd/1.9.0` | `https://w3id.org/okn/o/sdm/1.7.0` |
| `owl:versionInfo` | `1.9.0` | `1.7.0` |
| `owl:priorVersion` | `https://w3id.org/okn/o/sd/1.8.0` | `https://w3id.org/okn/o/sdm/1.7.0` (self — a bug) |
| `owl:backwardCompatibleWith` | `https://w3id.org/okn/o/sd/1.8.0` | — |
| `owl:imports` | none | `https://w3id.org/okn/o/sd/1.8.0` |
| `dc:title` | The Software Description Ontology | The Software Description Ontology for Models |
| `dc:created` | `September 29th, 2020` (a free-text string, not a date literal) | absent |
| GitHub release tag | `v1.9.0`, published **2021-05-03T23:34:51Z** | `v1.7.0`, published **2020-10-01T01:51:57Z** |
| Newest GitHub release | `v1.9.0` — **matches** what w3id serves | `v1.8.0`, published **2021-05-03T23:41:06Z** — **newer than what w3id serves** |
| GitHub Pages `last-modified` | 2025-01-31 (a site rebuild, not a release) | 2023-07-14 (a site rebuild) |
| Triples parsed | 963 | 365 |
| Source repo | [`KnowledgeCaptureAndDiscovery/SoftwareDescriptionOntology`](https://github.com/KnowledgeCaptureAndDiscovery/SoftwareDescriptionOntology) | [`mintproject/Mint-ModelCatalog-Ontology`](https://github.com/mintproject/Mint-ModelCatalog-Ontology) |

### 2.1 The `sdm` version problem

`https://mintproject.github.io/Mint-ModelCatalog-Ontology/release/1.8.0/ontology.ttl` returns **200**. Release 1.8.0 exists and is published. But `https://w3id.org/okn/o/sdm` still 303s to `release/1.7.0`. The w3id redirect rule was never updated.

The practical consequence is a **broken import closure** in what w3id serves:

- w3id serves `sdm` **1.7.0**, which declares `owl:imports <https://w3id.org/okn/o/sd/1.8.0>`.
- w3id serves `sd` **1.9.0**.
- So a tool that dereferences both `https://w3id.org/okn/o/sd` and `https://w3id.org/okn/o/sdm` gets **sd 1.9.0 alongside an sdm that expects sd 1.8.0**.
- `sdm` 1.8.0 fixes this: it declares `owl:imports <https://w3id.org/okn/o/sd/1.9.0>`.

`sdm` 1.8.0 differs from 1.7.0 only by **removing four bare stub properties** with no domain, range, label or comment: `sdm:hasConstraint`, `sdm:hasVariable`, `sdm:hasMaximumValue`, `sdm:hasMinimumValue`. It adds nothing. It does **not** add `sdm:gridType`.

**Recommendation for the map's test (decision 7).** Do not fetch `https://w3id.org/okn/o/sdm` as the authority. Check in the version-pinned artefacts instead:

- `https://knowledgecaptureanddiscovery.github.io/SoftwareDescriptionOntology/release/1.9.0/ontology.ttl`
- `https://mintproject.github.io/Mint-ModelCatalog-Ontology/release/1.8.0/ontology.ttl`

That also satisfies "there is no runtime fetch of `w3id.org`".

---

## 3. Classes — the 47 `typeUri` check

`model-catalog-api/src/mappers/resource-registry.ts` holds **47 `typeUri` occurrences**, **46 distinct IRIs**. `https://w3id.org/okn/o/sdm#Theory-GuidedModel` appears twice, on `theory-guidedmodels` and on its alias `theory_guidedmodels` (the OpenAPI `operationId` uses an underscore, the URL path a hyphen).

**All 46 distinct `typeUri` values are defined by the published ontology. None is missing.**

Split: 25 in `sd#`, 21 in `sdm#`.

Six `sd#` classes are additionally *re-declared* inside the `sdm` file (`Software`, `SoftwareConfiguration`, `ConfigurationSetup`, `DatasetSpecification`, `Image`, `Parameter`, `VariablePresentation`). That is ordinary Protégé cross-file declaration, not a redefinition; the authoritative axioms live in `sd`.

### 3.1 `sd` — `owl:Class` (25 own)

| Local name (exact casing) | `rdfs:subClassOf` |
|---|---|
| `CatalogIdentifier` | `sd:Parameter` |
| `ConfigurationSetup` | `sd:SoftwareConfiguration` |
| `Constraint` | — |
| `DataTransformation` | `sd:SoftwareConfiguration` |
| `DataTransformationSetup` | `sd:ConfigurationSetup`, `sd:DataTransformation` |
| `DatasetSpecification` | `cube:DataStructureDefinition` |
| `FundingInformation` | — |
| `Image` | `sd:DatasetSpecification` |
| `NumericalIndex` | `sd:Variable` |
| `Organization` | `schema:Organization` |
| `Parameter` | — |
| `Person` | `schema:Person` |
| `SampleCollection` | `sd:SampleResource` |
| `SampleExecution` | `prov:Activity` |
| `SampleResource` | `prov:Entity` |
| `Software` | `schema:SoftwareApplication` |
| `SoftwareConfiguration` | `sd:Software` |
| `SoftwareImage` | `sd:Software` |
| `SoftwareVersion` | `sd:Software` |
| `SourceCode` | `schema:SoftwareSourceCode` |
| `StandardVariable` | `sd:Variable` |
| `Unit` | `qudt:Unit` |
| `Variable` | — |
| `VariablePresentation` | `sd:Variable` |
| `Visualization` | — |

Prefixes: `cube:` = `http://purl.org/linked-data/cube#`, `prov:` = `http://www.w3.org/ns/prov#`, `qudt:` = `http://qudt.org/schema/qudt/`, `schema:` = `http://schema.org/` (**http**, not https).

### 3.2 `sdm` — `owl:Class` (23 own)

| Local name (exact casing) | `rdfs:subClassOf` |
|---|---|
| `Category` | — |
| `CausalDiagram` | — |
| `Constraint` | — |
| `CoupledModel` | `sdm:Model` |
| `EmpiricalModel` | `sdm:Model` |
| `Emulator` | `sdm:Model` |
| `Equation` | — |
| `GeoCoordinates` | `schema:GeoCoordinates` |
| `GeoShape` | `schema:GeoShape` |
| `Grid` | `sd:DatasetSpecification` |
| `HybridModel` | `sdm:Model` |
| `Intervention` | — |
| `Model` | `sd:Software` |
| `ModelCategory` | — |
| `ModelConfiguration` | `sd:SoftwareConfiguration`, `sdm:Model` |
| `ModelConfigurationSetup` | `sd:ConfigurationSetup`, `sdm:ModelConfiguration` |
| `PointBasedGrid` | `sdm:Grid` |
| `Process` | — |
| `Region` | `schema:Place` |
| `SpatialResolution` | — |
| `SpatiallyDistributedGrid` | `sdm:Grid` |
| `Theory-GuidedModel` | `sdm:Model` |
| `TimeInterval` | — |

Two of these are declared but unreachable by any property: `sdm:Category` (a leftover; `sdm:ModelCategory` is the live one) and `sdm:SpatialResolution`. The registry exposes `sdm#SpatialResolution` as a full resource, yet the ontology's `sdm:hasSpatialResolution` is a **`owl:DatatypeProperty` with range `xsd:string`** — no object property ever points at the class. The serializer will therefore emit `sdm:SpatialResolution` subjects that nothing links to.

`sdm:Theory-GuidedModel` carries a hyphen in the local name. It is legal in a Turtle `PN_LOCAL`, but any serializer that mints prefixed names must not assume `[A-Za-z0-9]` only.

---

## 4. Properties, with exact casing, domain and range

### 4.1 `sd` — `owl:ObjectProperty` (39)

| Local name (exact casing) | Domain | Range | Functional |
|---|---|---|---|
| `adjustableParameter` | `sd:ConfigurationSetup` | `sd:Parameter` | |
| `adjustsVariable` | `sd:Parameter` | `sd:Variable` | yes |
| `author` | `sd:Software` | (`sd:Organization` or `sd:Person`) | |
| `compatibleVisualizationSoftware` | `sd:Software` | `sd:Software` | |
| `contributor` | `sd:Software` | `sd:Person` | |
| `copyrightHolder` | `sd:Software` | (`sd:Organization` or `sd:Person`) | |
| `fundingSource` | `sd:FundingInformation` | `sd:Organization` | |
| `hadPrimarySource` | (`sd:Image` or `sd:Software` or `sd:Visualization`) | `owl:Thing` | |
| `hasConfiguration` | `sd:SoftwareVersion` | `sd:SoftwareConfiguration` | |
| `hasConstraint` | `sd:SoftwareConfiguration` | `sd:Constraint` | |
| `hasContactPerson` | `sd:Software` | (`sd:Organization` or `sd:Person`) | |
| `hasDataTransformation` | `sd:DatasetSpecification` | `sd:DataTransformation` | |
| `hasDataTransformationSetup` | `sd:DatasetSpecification` | `sd:DataTransformationSetup` | |
| `hasFileStructure` | `sd:DatasetSpecification` | **none declared** | yes |
| `hasFixedResource` | `sd:DatasetSpecification` | `sd:SampleResource` | |
| `hasFunding` | `sd:Software` | `sd:FundingInformation` | |
| `hasInput` | `sd:SoftwareConfiguration` | `sd:DatasetSpecification` | |
| `hasOutput` | `sd:SoftwareConfiguration` | `sd:DatasetSpecification` | |
| `hasParameter` | `sd:SoftwareConfiguration` | `sd:Parameter` | |
| `hasPart` | `sd:SampleCollection` | `sd:SampleResource` | |
| `hasPresentation` | (`sd:DatasetSpecification` or `sd:Parameter`) | `sd:VariablePresentation` | |
| `hasSampleExecution` | `sd:SoftwareConfiguration` | `sd:SampleExecution` | |
| `hasSampleResult` | `sd:SoftwareConfiguration` | `sd:SampleResource` | |
| `hasSampleVisualization` | `sd:Software` | `sd:Visualization` | |
| `hasSetup` | `sd:SoftwareConfiguration` | `sd:ConfigurationSetup` | |
| `hasSoftwareImage` | `sd:SoftwareConfiguration` | `sd:SoftwareImage` | yes |
| `hasSourceCode` | `sd:Software` | `sd:SourceCode` | yes |
| `hasStandardVariable` | (`sd:NumericalIndex` or `sd:VariablePresentation`) | `sd:StandardVariable` | yes |
| `hasVariable` | `sd:Constraint` | `sd:VariablePresentation` | |
| `hasVersion` | `sd:Software` | `sd:SoftwareVersion` | |
| `isTransformedFrom` | `sd:DatasetSpecification` | `sd:DatasetSpecification` | |
| `logo` | `sd:Software` | `sd:Image` | |
| `partOfDataset` | `sd:VariablePresentation` | `sd:DatasetSpecification` | |
| `publisher` | `sd:Software` | (`sd:Organization` or `sd:Person`) | |
| `screenshot` | `sd:Software` | `sd:Image` | |
| `usefulForCalculatingIndex` | `sd:Software` | `sd:NumericalIndex` | |
| `usesUnit` | (`sd:Parameter` or `sd:VariablePresentation`) | `sd:Unit` | yes |
| `wasDerivedFromSetup` | `sd:ConfigurationSetup` | `sd:ConfigurationSetup` | |
| `wasDerivedFromSoftware` | `sd:Visualization` | `sd:Software` | |

### 4.2 `sd` — `owl:DatatypeProperty` (64)

| Local name (exact casing) | Domain | Range |
|---|---|---|
| `availableInRegistry` | `sd:SoftwareImage` | `xsd:anyURI` |
| `citation` | `sd:Software` | `xsd:string` |
| `codeRepository` | `sd:SourceCode` | `xsd:anyURI` |
| `copyrightYear` | **none** | **none** |
| `dataCatalogIdentifier` | `sd:SampleResource` | `xsd:string` |
| `dateCreated` | `sd:Software` | `xsd:dateTime` |
| `datePublished` | `sd:Software` | `xsd:dateTime` |
| `description` | (`owl:Thing` or `sd:NumericalIndex` or `sd:Organization` or `sd:Parameter` or `sd:Person` or `sd:SampleExecution` or `sd:SampleResource` or `sd:Software` or `sd:SourceCode` or `sd:Variable` or `sd:Visualization`) | `xsd:string` |
| `doi` | `sd:Software` | `xsd:string` |
| `email` | `sd:Person` | `xsd:string` |
| `fundingGrant` | `sd:FundingInformation` | `xsd:string` |
| `hasAcceptedValues` | `sd:Parameter` | `xsd:string` |
| `hasAcknowledgements` | `sd:Software` | `xsd:string` |
| `hasAssumption` | `sd:Software` | `xsd:string` |
| `hasBuildFile` | `sd:Software` | `xsd:anyURI` |
| `hasCodeOfConduct` | `sd:Software` | (`xsd:anyURI` or `xsd:string`) |
| `hasComponentLocation` | `sd:SoftwareConfiguration` | `xsd:anyURI` |
| `hasDataType` | `sd:Parameter` | `xsd:string` |
| `hasDefaultValue` | (`sd:Parameter` or `sd:VariablePresentation`) | (`xsd:anyURI` or `xsd:boolean` or `xsd:dateTime` or `xsd:float` or `xsd:integer` or `xsd:string`) |
| `hasDimensionality` | `sd:DatasetSpecification` | `xsd:integer` |
| `hasDocumentation` | `sd:Software` | `xsd:anyURI` |
| `hasDownloadInstructions` | `sd:Software` | `xsd:string` |
| **`hasDownloadURL`** | `sd:Software` | `xsd:anyURI` |
| `hasExample` | `sd:Software` | `xsd:string` |
| `hasExecutableInstructions` | `sd:Software` | `xsd:string` |
| `hasExecutableNotebook` | `sd:Software` | `xsd:anyURI` |
| `hasExecutionCommand` | (`sd:SampleExecution` or `sd:SoftwareConfiguration` or `sd:SoftwareImage`) | `xsd:string` |
| **`hasFAQ`** | `sd:Software` | `xsd:string` |
| `hasFixedValue` | `sd:Parameter` | (`xsd:anyURI` or `xsd:boolean` or `xsd:dateTime` or `xsd:float` or `xsd:integer` or `xsd:string`) |
| `hasFormat` | (`sd:DatasetSpecification` or `sd:Visualization`) | `xsd:string` |
| `hasImplementationScriptLocation` | `sd:SoftwareConfiguration` | `xsd:anyURI` |
| `hasInstallationInstructions` | `sd:Software` | `xsd:string` |
| `hasLongName` | `sd:VariablePresentation` | `xsd:string` |
| `hasMaximumAcceptedValue` | (`sd:Parameter` or `sd:VariablePresentation`) | (`xsd:dateTime` or `xsd:float` or `xsd:integer`) |
| `hasMinimumAcceptedValue` | (`sd:Parameter` or `sd:VariablePresentation`) | (`xsd:dateTime` or `xsd:float` or `xsd:integer`) |
| `hasPurpose` | `sd:Software` | `xsd:string` |
| `hasRule` | `sd:Constraint` | `xsd:string` |
| `hasShortName` | `sd:VariablePresentation` | `xsd:string` |
| `hasStepSize` | `sd:Parameter` | `xsd:float` |
| `hasSupportScriptLocation` | `sd:SoftwareConfiguration` | `xsd:anyURI` |
| `hasTypicalDataSource` | `sd:Software` | `xsd:anyURI` |
| `hasUsageNotes` | `sd:Software` | `xsd:string` |
| `hasVersionId` | `sd:SoftwareVersion` | `xsd:string` |
| `identifier` | (`sd:Organization` or `sd:Person` or `sd:Software`) | `xsd:string` |
| `issueTracker` | `sd:Software` | `xsd:anyURI` |
| `keywords` | `sd:Software` | `xsd:string` |
| `license` | (`sd:Software` or `sd:SourceCode`) | `xsd:anyURI` |
| `memoryRequirements` | `sd:Software` | `xsd:string` |
| `name` | **none** | `xsd:string` |
| `operatingSystems` | `sd:Software` | `xsd:string` |
| `pathLocation` | `sd:DatasetSpecification` | `xsd:string` |
| `position` | (`sd:DatasetSpecification` or `sd:Parameter`) | `xsd:integer` |
| `processorRequirements` | `sd:Software` | `xsd:string` |
| `programmingLanguage` | `sd:SourceCode` | `xsd:string` |
| `readme` | `sd:Software` | `xsd:anyURI` |
| `recommendedIncrement` | `sd:Parameter` | `xsd:float` |
| `referencePublication` | `sd:Software` | `xsd:string` |
| `shortDescription` | `sd:Software` | `xsd:string` |
| `softwareRequirements` | `sd:Software` | `xsd:string` |
| `status` | `sd:ConfigurationSetup` | `xsd:string` |
| `supportDetails` | `sd:Software` | `xsd:string` |
| `tag` | (`sd:ConfigurationSetup` or `sd:SoftwareConfiguration` or `sd:SoftwareVersion`) | `xsd:string` |
| `value` | (`sd:Image` or `sd:SampleResource` or `sd:Visualization`) | (`xsd:anyURI` or `xsd:boolean` or `xsd:dateTime` or `xsd:float` or `xsd:integer` or `xsd:string`) |
| `website` | (`sd:Organization` or `sd:Person` or `sd:Software`) | `xsd:anyURI` |

### 4.3 `sdm` — `owl:ObjectProperty` (22)

| Local name (exact casing) | Domain | Range |
|---|---|---|
| `calibratedVariable` | `sdm:ModelConfigurationSetup` | `sd:VariablePresentation` |
| `calibrationTargetVariable` | `sdm:ModelConfigurationSetup` | `sd:VariablePresentation` |
| `geo` | `sdm:Region` | (`sdm:GeoCoordinates` or `sdm:GeoShape`) |
| `hasCausalDiagram` | `sdm:ModelConfiguration` | `sdm:CausalDiagram` |
| `hasConstraint` | **none** | **none** — bare stub, removed in 1.8.0 |
| `hasDiagramPart` | `sdm:CausalDiagram` | (`sd:VariablePresentation` or `sdm:Process`) |
| `hasEquation` | `sdm:Model` | `sdm:Equation` |
| `hasExplanationDiagram` | `sdm:Model` | `sd:Image` |
| `hasGrid` | `sdm:Model` | `sdm:Grid` |
| `hasInputVariable` | `sdm:Model` | `sd:VariablePresentation` |
| `hasModelCategory` | `sdm:Model` | `sdm:ModelCategory` |
| `hasOutputTimeInterval` | `sdm:ModelConfiguration` | `sdm:TimeInterval` |
| `hasOutputVariable` | `sdm:Model` | `sd:VariablePresentation` |
| `hasProcess` | `sdm:Model` | `sdm:Process` |
| `hasRegion` | `sdm:ModelConfiguration` | `sdm:Region` |
| `hasVariable` | **none** | **none** — bare stub, removed in 1.8.0 |
| `influences` | `sdm:Process` | `sdm:Process` |
| `intervalUnit` | `sdm:TimeInterval` | `qudt:Unit` |
| `parentCategory` | `sdm:ModelCategory` | `sdm:ModelCategory` |
| `partOf` | `sdm:Region` | `sdm:Region` |
| `relevantForIntervention` | `sd:Parameter` | `sdm:Intervention` |
| `usesModel` | `sdm:Model` | `sdm:Model` |

`sdm` also references, but does not define, `sd:usesUnit`, `schema:contentLocation` and `schema:geo`.

### 4.4 `sdm` — `owl:DatatypeProperty` (20)

| Local name (exact casing) | Domain | Range | Functional |
|---|---|---|---|
| `box` | `sdm:GeoShape` | `xsd:string` | |
| `calibrationInterval` | `sdm:ModelConfigurationSetup` | `xsd:string` | |
| `calibrationMethod` | `sdm:ModelConfigurationSetup` | `xsd:string` | |
| `elevation` | (`sdm:GeoCoordinates` or `sdm:GeoShape`) | `xsd:string` | |
| `hasCoordinateSystem` | `sdm:Grid` | `xsd:string` | yes |
| **`hasDimension`** | `sdm:Grid` | `xsd:string` | yes |
| `hasMaximumValue` | **none** | **none** — bare stub, removed in 1.8.0 | |
| `hasMinimumValue` | **none** | **none** — bare stub, removed in 1.8.0 | |
| `hasModelResultTable` | `sdm:ModelConfiguration` | `xsd:string` | |
| `hasShape` | `sdm:Grid` | `xsd:string` | |
| `hasSpatialResolution` | `sdm:Grid` | `xsd:string` | |
| `intervalValue` | `sdm:TimeInterval` | (`xsd:integer` or `xsd:string`) | |
| `latitude` | (`sdm:GeoCoordinates` or `sdm:GeoShape`) | `xsd:string` | |
| `limitations` | `sdm:Model` | `xsd:string` | |
| `longitude` | (`sdm:GeoCoordinates` or `sdm:GeoShape`) | `xsd:string` | |
| `parameterAssignmentMethod` | `sdm:ModelConfigurationSetup` | `xsd:string` | |
| `parameterization` | `sdm:Model` | `xsd:string` | |
| `runtimeEstimation` | `sdm:Model` | `xsd:string` | |
| `theoreticalBasis` | `sdm:Model` | `xsd:string` | |
| `validUntil` | `sdm:ModelConfigurationSetup` | `xsd:dateTime` | |

**Totals: `sd` defines 39 object + 64 datatype = 103 properties and 25 classes. `sdm` defines 22 object + 20 datatype = 42 properties and 23 classes.**

---

## 5. Casing — the point of this ticket

### 5.1 The acronym audit

Exactly **two** terms in either ontology carry two or more consecutive capitals. Both are in `sd`, both are datatype properties, and neither is in `sdm`:

| Ontology IRI | Local name | Naive camelCase | Agree? |
|---|---|---|---|
| `https://w3id.org/okn/o/sd#hasDownloadURL` | `hasDownloadURL` | `hasDownloadUrl` | **no** |
| `https://w3id.org/okn/o/sd#hasFAQ` | `hasFAQ` | `hasFaq` | **no** |

Every other acronym-looking name uses ordinary camelCase and is safe:

| Local name | Note |
|---|---|
| `hasVersionId` | `Id`, **not** `ID` |
| `doi` | all lowercase, **not** `DOI` |
| `dataCatalogIdentifier` | spelled out |
| `hasCoordinateSystem`, `hasModelResultTable` | no acronym |
| `GeoCoordinates`, `GeoShape`, `PointBasedGrid` | classes, ordinary PascalCase |
| `Theory-GuidedModel` | class, hyphenated |

**Verdict on the ticket's hypothesis: confirmed.** The ontology says `hasDownloadURL`. The API's `snakeToCamel` produces `hasDownloadUrl`. The ticket's premise is correct.

### 5.2 Where the three layers disagree

| Layer | Spelling | Evidence |
|---|---|---|
| Published ontology | `hasDownloadURL` | `https://w3id.org/okn/o/sd` §4.2 |
| `model-catalog-api/openapi.yaml` | `hasDownloadURL` | 20+ schema definitions, e.g. line 9999 |
| Runtime response (`snakeToCamel`) | `hasDownloadUrl` | `model-catalog-api/src/mappers/response.ts:22`; asserted in `src/mappers/__tests__/response.test.ts:14` |
| Postgres column | `has_download_url` | `model-catalog-api/src/hasura/field-maps.ts:40` |

So the API **advertises** `hasDownloadURL` in its own OpenAPI document and **returns** `hasDownloadUrl`. That is a pre-existing contract bug, independent of this map, and worth its own ticket.

`hasFAQ` appears in `openapi.yaml` but **no `has_faq` column exists** in `modelcatalog_*` and the ETL never queries it. It is an advertised field the API can never populate.

### 5.3 Why the predicate map cannot be a function of the column name

Map decision 7 is correct, and for a bigger reason than acronyms. Of 72 ETL `(predicate, SPARQL variable)` pairs, **28 do not round-trip**. Only one of those 28 is an acronym.

The other 27 fail because the ETL names a relationship column after the **target entity**, not after the predicate:

| Column | `snakeToCamel` gives | Real predicate |
|---|---|---|
| `input` | `input` | `sd:hasInput` |
| `output` | `output` | `sd:hasOutput` |
| `parameter` | `parameter` | `sd:hasParameter` |
| `setup` | `setup` | `sd:hasSetup` |
| `version` | `version` | `sd:hasVersion` |
| `configuration` | `configuration` | `sd:hasConfiguration` |
| `presentation` | `presentation` | `sd:hasPresentation` |
| `region` | `region` | `sdm:hasRegion` |
| `grid` | `grid` | `sdm:hasGrid` |
| `process` | `process` | `sdm:hasProcess` |
| `diagram` | `diagram` | `sdm:hasCausalDiagram` |
| `image` | `image` | `sdm:hasExplanationDiagram` |
| `intervention` | `intervention` | `sdm:relevantForIntervention` |
| `time_interval` | `timeInterval` | `sdm:hasOutputTimeInterval` |
| `part` | `part` | `sdm:hasDiagramPart` |
| `parent` | `parent` | `sdm:hasModelCategory` |
| `category` | `category` | `sdm:hasModelCategory` |
| `author_id` | `authorId` | `sd:author` |
| `version_id` | `versionId` | `sd:hasVersionId` |
| `usage_notes` | `usageNotes` | `sd:hasUsageNotes` |

And **one column is genuinely ambiguous**: `variable` is bound by five different predicates in five different queries — `sd:adjustsVariable`, `sdm:calibratedVariable`, `sdm:calibrationTargetVariable`, `sdm:hasInputVariable`, `sdm:hasOutputVariable`. The correct predicate depends on the owning table, not on the column name. **The checked-in table must be keyed by (table, column), not by column alone.**

Two columns — `usage_notes` and `has_usage_notes` — both come from `sd:hasUsageNotes` in different queries. The map's table needs to tolerate that.

---

## 6. ETL predicates the ontology does not define

`etl/extract.py` uses **70 distinct `sd:`/`sdm:` tokens** (68 properties plus the class references `sd:Unit` and `sdm:Model`). **Two are undefined:**

| ETL token | Location | Diagnosis |
|---|---|---|
| `sd:hasDimension` | `etl/extract.py:1586` | **Wrong prefix.** `sd` has no `hasDimension`. The real term is **`sdm:hasDimension`** (`rdfs:domain sdm:Grid`, `rdfs:range xsd:string`, functional, "Dimension of the grid (2D, 3D)"). The query binds `?has_dimension` inside the `sdm:Grid` extractor, so the intent is unambiguous. `modelcatalog_grid.has_dimension` was therefore never populated by the migration. |
| `sdm:gridType` | `etl/extract.py:1590` | **Does not exist**, in 1.7.0 or in 1.8.0. The nearest published term is `sdm:hasShape`, whose comment is "Grids may be: rectangular, triangular, hexagonal, hybrid, unstructured, block structure, etc." — that *is* the grid type. The ETL already maps `sdm:hasShape` to `has_shape` in the same query, so `grid_type` is a duplicate concept under an invented predicate. `modelcatalog_grid.grid_type` was never populated either. |

Both columns exist in the schema (`graphql_engine/migrations/1771105510000_modelcatalog_extended_schema/up.sql:76`) and both are selected by `model-catalog-api/src/hasura/field-maps.ts:524-533`.

**Consequence for the map.** `modelcatalog_grid.grid_type` is a first-class instance of decision 8 — an unmapped column that must be dropped, because no ontology predicate exists to mint. `modelcatalog_grid.has_dimension` is *not* a drop: map it to `sdm:hasDimension` and, separately, fix the ETL prefix.

Nothing else in the ETL is missing. The remaining 66 properties and 2 classes are all defined.

---

## 7. Disagreements with the local knowledge base

Checked against `knowledge-base/wiki/software-description-ontology.md` (last updated 2026-06-06) and `knowledge-base/wiki/variable-presentation.md` (last updated 2026-06-13).

**These pages are accurate. Nothing in either page is contradicted by the published ontology.** Every specific claim verified:

| Wiki claim | Verified |
|---|---|
| `sd:VariablePresentation rdfs:subClassOf sd:Variable` | yes |
| `sd:hasShortName`, `sd:hasLongName` — domain `VariablePresentation`, range `xsd:string` | yes, both |
| `sd:hasStandardVariable` links presentation to standard variable | yes, range `sd:StandardVariable`, functional |
| `sd:usesUnit` carries the unit | yes, object property, range `sd:Unit`, functional |
| Configurations declare `sd:hasInput`, `sd:hasOutput`, `sd:Parameter` | yes; the property is `sd:hasParameter`, whose range is the class `sd:Parameter` |
| `sd:DatasetSpecification` captures `sd:hasFormat` | yes |
| 4-level hierarchy Software → Version → Configuration → Setup | yes — `sd:SoftwareVersion`/`sd:SoftwareConfiguration`/`sd:SoftwareImage` are all `rdfs:subClassOf sd:Software`, and `sd:ConfigurationSetup rdfs:subClassOf sd:SoftwareConfiguration` |
| `sd:StandardVariable` is the SVO link | yes, `rdfs:subClassOf sd:Variable` |
| API exposes `hasShortName`, `hasLongName`, `hasStandardVariable`, `usesUnit` | yes, and all four match the ontology casing exactly |
| SD is at v1.9.0 | yes |

Five **gaps**, not errors. None requires a correction; all are candidates for a later wiki edit outside this map:

1. **Neither page states the `sdm` version.** `sdm` is at 1.7.0 as served, 1.8.0 as released. Worth pinning, given §2.1.
2. **`software-description-ontology.md:11` attributes "assumptions" to `sdm`.** `sd:hasAssumption` is in **`sd`** (domain `sd:Software`), not `sdm`. Grids, time intervals, equations and processes are correctly attributed to `sdm`. A one-word inaccuracy.
3. **`software-description-ontology.md:32`** says developers interact "via JSON / JSON-LD REST APIs … or SPARQL". The SPARQL endpoint is retired ([ADR-0001](../adr/0001-model-catalog-postgres-hasura-over-fuseki-sparql.md)), and the REST API does not currently serve JSON-LD. The sentence is a faithful quote of the 2019 paper; it is stale as a statement about MINT today.
4. **Neither page records that `sd` extends `http://schema.org/` over plain HTTP**, not `https://schema.org/`. That matters for a serializer emitting `@prefix schema:`.
5. **Neither page mentions the `sd:hasDownloadURL` / `hasDownloadUrl` split.** It is the single sharpest fact an implementer needs.

---

## 8. Other findings a serializer must handle

1. **`sd:hasFileStructure` declares a domain but no range.** Any range-driven typing logic must tolerate that.
2. **`sd:copyrightYear` declares neither domain nor range.** So does the removed-in-1.8.0 `sdm` stub set.
3. **`sd:name` has no domain.** It is used on almost every class in practice.
4. **Six datatype properties have a *union* range** including `xsd:anyURI`, `xsd:boolean`, `xsd:dateTime`, `xsd:float`, `xsd:integer` and `xsd:string`: `hasDefaultValue`, `hasFixedValue`, `value`, and the narrower `hasMaximumAcceptedValue`/`hasMinimumAcceptedValue`/`intervalValue`. The ontology **cannot** tell the serializer which literal type to emit. This independently vindicates map decision 9: take the type from the Postgres column, never from the ontology and never from the value.
5. **`sd:dateCreated` and `sd:datePublished` have range `xsd:dateTime`**, yet the map recorded `date_created` holding the bare string `"2018"`. Emitting `"2018"^^xsd:dateTime` would be invalid, not merely imprecise. Decision 9 (type from the column, which is `text`) is the only safe reading.
6. **`sd:position` and `sd:hasDimensionality` have range `xsd:integer`** and are among the 3 integer columns. These are the only places where the ontology range and the column type agree on a non-string.
7. **The `schema.org` prefix is `http://schema.org/`**, not `https://`. `sd:Person rdfs:subClassOf http://schema.org/Person`.
8. **`sd` imports nothing.** It references `prov:`, `qudt:`, `cube:`, `codemeta:` and `schema:` terms by IRI without an `owl:imports`. A validation test must not expect an import closure to resolve.

---

## 9. Recommendations for map #214

1. **Key the checked-in predicate table by `(table, column)`.** `variable` proves a column-only key is wrong (§5.3).
2. **Validate against version-pinned files, not `w3id.org`** (§2.1). Pin `sd` 1.9.0 and `sdm` **1.8.0**.
3. **Send `Vary: Accept`** on every negotiated response. The reference implementation omits it (§1.4).
4. **Set `Content-Type: text/turtle` explicitly.** Do not inherit the JSON-LD mis-typing seen at hop 3 (§1.4).
5. **Drop `modelcatalog_grid.grid_type`** under decision 8 — no predicate exists. **Do not drop `has_dimension`**; map it to `sdm:hasDimension` (§6).
6. **Spell it `sd:hasDownloadURL`** in the predicate table. The JSON field name stays `hasDownloadUrl`; the two layers are allowed to differ, and the table is the place that records it (§5.2).
7. **`sdm:SpatialResolution` subjects will be orphans.** No object property in the ontology points at that class (§3.2). Decide whether to serialize the resource at all.
8. Open a separate ticket for the OpenAPI-vs-runtime `hasDownloadURL` / `hasDownloadUrl` contract bug and the never-populated `hasFAQ` field. Neither belongs to this map.

---

## Sources

- `https://w3id.org/okn/o/sd` — fetched 2026-09-02, resolves to `https://knowledgecaptureanddiscovery.github.io/SoftwareDescriptionOntology/release/1.9.0/ontology.ttl`
- `https://w3id.org/okn/o/sdm` — fetched 2026-09-02, resolves to `https://mintproject.github.io/Mint-ModelCatalog-Ontology/release/1.7.0/ontology.ttl`
- `https://mintproject.github.io/Mint-ModelCatalog-Ontology/release/1.8.0/ontology.ttl` — fetched 2026-09-02
- `https://api.github.com/repos/KnowledgeCaptureAndDiscovery/SoftwareDescriptionOntology/releases`
- `https://api.github.com/repos/mintproject/Mint-ModelCatalog-Ontology/releases`
- `model-catalog-api/src/mappers/resource-registry.ts`
- `model-catalog-api/src/mappers/response.ts`
- `model-catalog-api/src/hasura/field-maps.ts`
- `model-catalog-api/openapi.yaml`
- `etl/extract.py`
- `graphql_engine/migrations/1771105510000_modelcatalog_extended_schema/up.sql`
- `knowledge-base/wiki/software-description-ontology.md`
- `knowledge-base/wiki/variable-presentation.md`
