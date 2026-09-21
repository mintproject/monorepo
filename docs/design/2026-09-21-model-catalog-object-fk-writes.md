# Model Catalog REST Object-FK Writes

Status: Approved

## Objective

Make the Model Catalog REST API persist supported object relationships, beginning
with `VariablePresentation.hasStandardVariable` and `VariablePresentation.usesUnit`,
so MINT registrations can link presentations to their standard variables through
the supported REST API.

## User need

- **Primary user:** MINT catalog/registration operator.
- **Secondary users:** MINT facilitators and data scientists consuming registered
  model configurations.
- **Job-to-be-done:** Register model configurations whose variable presentations
  resolve to the intended standard variables.
- **Current pain:** REST writes return success while silently dropping object
  relationship links.
- **Definition of success:** A REST POST/PUT containing an object relationship
  writes the FK, and a subsequent GET returns the linked object.

## Current code/system summary

`resource-registry.ts` declares object relationships with `type: 'object'`.
`nested-tree.ts` currently creates write edges only for junction-table and
child-FK relationships. `request.ts` excludes relationship fields from scalar
columns, so an object relationship is accepted and then discarded. The deployed
API therefore returns HTTP 200 without changing the object FK.

## Proposed design

Add an object-FK relationship edge to the nested write tree. For a link-only
object payload (`{ id }`), the compiler emits an aliased Hasura update setting
the parent row's FK column to that ID. For a null object, it clears the FK. For
unsupported nested object creation, return a validation error rather than
silently ignoring the relationship. Keep junction and child-FK behavior
unchanged.

The registry will declare the scalar FK column for object relationships. The
field map will continue selecting the related object for reads; the FK column
will be used only for writes.

## Files likely affected

- `model-catalog-api/src/mappers/resource-registry.ts`
- `model-catalog-api/src/mappers/nested-tree.ts`
- `model-catalog-api/src/mappers/mutation-compiler.ts`
- `model-catalog-api/src/mappers/__tests__/nested-tree.test.ts`
- `model-catalog-api/src/mappers/__tests__/mutation-compiler.test.ts`
- `model-catalog-api/README.md` (REST relationship behavior)

## API/schema changes

No database schema or GraphQL schema changes. The existing REST relationship
shape is made effective for object relationships. The first supported mappings
are `hasStandardVariable -> has_standard_variable` and
`usesUnit -> uses_unit` on `modelcatalog_variable_presentation`.

## Data flow

REST request -> resource registry -> nested write tree -> mutation compiler ->
Hasura update mutation -> FK persisted -> REST read selects the related object.

## Risks and tradeoffs

- Object-FK updates must be permission-checked by Hasura using the caller's
  bearer token, just like existing writes.
- Supporting only link-only object payloads avoids inventing create/upsert
  semantics for object relationships.
- The API must reject malformed object payloads instead of silently ignoring
  them.
- Deployment must be verified before rerunning MINT registration.

## Alternatives considered

- Direct GraphQL updates: rejected for the normal workflow because the supported
  REST API should own registration writes.
- Database migration: not needed; the FK columns and relationships already
  exist.
- Adding a registration-script workaround: rejected because it would preserve
  the REST API defect and leave other object relationships broken.

## Test plan

- Unit-test tree construction for object-FK link and clear payloads.
- Unit-test compiled POST/PUT mutations and variables.
- Run TypeScript type checking and the full model-catalog API unit suite.
- After deployment, run a read/write/read smoke check for one presentation and
  verify all eight GAM presentation links through the API/GraphQL read path.

## Documentation plan

Update the Model Catalog API README to describe supported object relationship
write payloads and the link-only constraint.

## Rollout/rollback plan

Build and publish the API image through the existing CI deployment path, restart
only the stateless API pod, verify health and object-FK behavior, then rerun the
approved MINT registration. Rollback is the prior API image if health or the
relationship smoke check fails. Existing MINT rows created by the earlier REST
run remain intact and can be safely reused.

## Open questions

None for the approved scope. Additional object relationships can be mapped later
after confirming their FK column names.

## Decisions

- Use the REST API as the supported write path.
- Do not modify CKAN or the database schema.
- Do not execute a MINT model; only register and verify model metadata.
- Keep the first fix limited to object-FK relationships needed by variable
  presentations.

## User feedback / decisions

- User approved fixing and deploying REST object-FK support, then rerunning the
  MINT registration.
