# Show and Delete User-Owned Model Configurations

Status: Implemented

## Objective

Implement GitHub issues [#213](https://github.com/mintproject/monorepo/issues/213) and [#212](https://github.com/mintproject/monorepo/issues/212): let an authenticated MINT user identify the model configurations they registered and delete a configuration when they are its owner.

## User need

- **Primary user:** an authenticated MINT catalog user.
- **Job to be done:** distinguish model configurations I registered from the shared catalog, find my registrations, and remove one I no longer want.
- **Definition of success:** a signed-in user can turn on a “My models” view, owned configurations are visibly marked, and the owned configuration detail offers a confirmation-protected delete action. A user who did not register a configuration cannot delete it, even if they bypass the UI.

## Current code/system summary

The current React UI browses model configurations through `ModelsBrowsePage`, groups flat rows into Model → Configuration → Setup in `groupConfigurations`, and displays a selected row through `ConfigurationDetail`. Registration creates a `modelcatalog_configuration` row in `CreateModelForm`.

The model catalog schema has semantic `author_id` fields that reference `modelcatalog_person`; those represent catalog authors and are not authenticated MINT users. It has no registration-owner field. Model-catalog Hasura metadata currently grants the `user` role unrestricted model-catalog deletes. The existing ETL-process table provides a local convention for an `owner_username` field and the `X-Hasura-User-Id` session claim.

## Proposed design

1. Add nullable `owner_username TEXT` to `modelcatalog_configuration`. Existing catalog rows remain unowned; only registrations created after this change receive an owner.
2. Add a user-role Hasura insert check requiring `owner_username` to equal the trusted `X-Hasura-User-Id` session claim, and change configuration delete permission to the same owner filter. Keep anonymous browsing and public catalog reads unchanged. The UI value is only a request value; the Hasura permission is authoritative.
3. Pass the authenticated user's username from `CreateModelForm` into the configuration insert mutation. In this deployment the username is the established value of `X-Hasura-User-Id`; the owner field is an authorization identity, not a display label. Do not reuse `author_id`, and do not allow normal users to update ownership.
4. Add a user-scoped GraphQL query for owned configuration IDs. The browse page will expose “My models” only when a user is authenticated, use the owned IDs to filter the existing grouped list, and mark owned rows with a small “Yours” badge when browsing all models.
5. Add a delete mutation and a confirmation dialog in the configuration detail flow. Show the delete action only for an owned root configuration with no child configurations; after success, evict/refetch the affected catalog data and navigate back to the browse landing state. Server-side authorization and the database's child-delete guard remain authoritative.
6. Remove `owner_username` and `model_configuration_id` from normal user update/insert columns, so ownership is write-once and browser users cannot create or reparent child configurations. Keep the owner field out of anonymous and authenticated select columns; the authenticated owned-ID query selects IDs and child IDs only.
7. Regenerate the UI GraphQL types from the updated Hasura schema when the local schema service is available. If code generation is unavailable, update only generated artifacts through the repository's established code-generation path rather than hand-editing generated output.

## Files likely affected

- `graphql_engine/migrations/<new-timestamp>_modelcatalog_configuration_owner/up.sql`
- `graphql_engine/migrations/<new-timestamp>_modelcatalog_configuration_owner/down.sql`
- `graphql_engine/metadata/tables.yaml`
- `ui-react/src/graphql/queries/model-catalog.graphql`
- `ui-react/src/graphql/mutations/model-catalog.graphql`
- `ui-react/src/graphql/owned-model-configurations.ts` (temporary inline Apollo operations until codegen)
- `ui-react/src/components/registration/CreateModelForm.tsx`
- `ui-react/src/components/models-browse/ModelsBrowsePage.tsx`
- `ui-react/src/components/models-browse/ModelGroupList.tsx`
- `ui-react/src/components/configuration/ConfigurationDetail.tsx`
- focused UI tests for registration, browse ownership, detail delete, and grouping/filtering
- generated GraphQL artifacts produced by `npm run codegen`
- a concise UI README note only if the final user workflow needs documentation beyond the visible controls

## API/schema changes

- Database: add nullable `modelcatalog_configuration.owner_username` and an index for it.
- Hasura GraphQL: add `owner_username` to the authenticated insert/check surface but keep it out of anonymous and authenticated select columns. Add a configuration delete mutation to the UI document and add an authenticated query that filters by the current user's username while returning only IDs/child IDs.
- Authorization: user inserts must satisfy `owner_username = X-Hasura-User-Id` and are root-only; user deletes must satisfy the same condition and target only a root configuration (`model_configuration_id IS NULL`). `owner_username` and `model_configuration_id` are not user-updateable. A database-level delete guard rejects deletion of a root that still has child configurations, preventing an owner delete from cascading into child rows.
- No REST endpoint or semantic `author_id` behavior changes.

## Data flow

Registration:

`AuthProvider.user.username` → `CreateModelForm` → authenticated Hasura insert check against `X-Hasura-User-Id` → `modelcatalog_configuration.owner_username`.

Browse:

`AuthProvider.user.username` → owned-ID query → client-side filtering/labels over the existing public model tree. The catalog's normal shared browse query remains unchanged, so signed-out users continue to browse anonymously.

Delete:

User selects an owned root configuration with no children → confirmation dialog → authenticated Hasura delete-by-primary-key → Hasura owner/root filter → database child-delete guard → database cascades configuration-owned junction rows and nulls configuration references from executions/thread models according to existing foreign keys → UI refetches and clears the selection.

## Risks and tradeoffs

- Existing catalog rows cannot be attributed retroactively; they will be visible but not deletable through this owner-only control.
- The frontend's ownership comparison is a convenience, not a security boundary. Hasura's insert check and delete filter must be tested as the real protection.
- The current deployment uses the username as `X-Hasura-User-Id`, following the existing modeling provenance convention. A deployment with a different claim mapping must update the identity source before enabling registration ownership; missing or mismatched identity must fail closed.
- Deleting a root configuration with child setups is blocked. Deleting a leaf/root without children cascades its relationship rows. Existing execution and thread-model foreign keys use `ON DELETE SET NULL`, so historical runs remain but lose their catalog reference.
- Normal browser users cannot claim or transfer ownership through update, bulk update, upsert, or nested mutation paths because the owner column is omitted from update columns and inserts are checked against the trusted session identity.
- A standalone configuration or a configuration linked to an existing model family is owned at the configuration level. The feature does not claim ownership of a pre-existing Software or SoftwareVersion family and does not delete those family rows.

## Alternatives considered

- **Reuse `author_id`:** rejected because it points to semantic catalog people, not authenticated users, and changing it would conflate authorship with ownership.
- **Infer ownership from URI, label, or timestamps:** rejected because identifiers are not an authorization record and existing rows have no reliable registration attribution.
- **Client-only ownership and deletion:** rejected because a user could call Hasura directly or alter the browser state.
- **Add a separate ownership table:** deferred. A single nullable owner column matches the existing ETL-process ownership convention and is sufficient for one owner per registered configuration. If the authentication system later exposes a stable subject distinct from username, migrate this field to that immutable subject before supporting username changes.
- **Make the entire model catalog private to each user:** rejected because the catalog's shared browsing behavior must remain intact.

## Test plan

- Migration/metadata validation: owner column, index, insert check, user delete filter, root-only condition, owner excluded from updates/anonymous selects, child-delete guard, and unchanged anonymous browse behavior.
- Registration UI: submits the authenticated username as `owner_username`; fails clearly if a protected form has no authenticated user.
- Browse UI: owned configurations are marked; “My models” is available only when signed in; owned-only filtering preserves grouping and setup nesting; empty owned state is clear.
- Detail UI: delete control appears only for owned root configurations; confirmation is required; successful deletion refreshes the list; mutation errors remain visible and do not remove the row optimistically.
- GraphQL/typecheck/build: run UI tests, `npm run typecheck`, `npm run build`, and `git diff --check`; run the focused Hasura/schema checks available in the repository.
- Authorization behavior: test that a non-owner delete is rejected or affects zero rows, a forged owner value cannot be inserted, ownership cannot be claimed or transferred through update/upsert paths, legacy `NULL` rows remain undeletable by normal users, and parent deletion with children is rejected. Run these against a disposable Hasura/database fixture when available; static metadata checks are the fallback.

## Documentation plan

Document the visible “My models” and owner-only delete behavior in the UI documentation only if the current README is the maintained user workflow. Keep schema/permission details in the design spec and migration comments; do not document unverified deployment behavior.

## Rollout/rollback plan

Apply the additive database migration and metadata before deploying the UI. Existing rows continue to browse normally. New UI code should be deployed only after the schema is present. Enable deletion only after the authenticated authorization and child-delete tests pass. Rollback is a code revert plus the migration's down step if the migration has not been used by newer writes; because owner data is new state, any rollback that removes the column must first account for those rows. No production data will be mutated in this implementation session.

## Open questions

- A future setup-registration flow may need independent ownership, but this change treats current UI registrations as root configurations and does not broaden setup ownership.
- An owned configuration that has been used by a thread remains deletable when it has no children; the current schema intentionally nulls those references on delete. The UI warns that catalog metadata will be removed while execution rows are preserved.

## Decisions

### 2026-09-16 - Use configuration-level `owner_username`

- **Decision:** record the authenticated username directly on each registered root configuration.
- **Reason:** the user request and issue #212 name the model configuration as the deletable unit; the existing semantic author field is not an account owner; and the ETL process already uses this naming convention.
- **Alternatives rejected:** semantic `author_id`, URI inference, client-only checks, and a separate ownership table (see above).
- **User feedback:** The user identified `monorepo` as the application repository and confirmed the matching GitHub issues are the ownership and owner-delete requests.
- **Impact on implementation:** one additive schema migration, Hasura permission updates, registration mutation changes, and React browse/detail controls.

### 2026-09-16 - Enforce write-once ownership and block parent deletion

- **Decision:** treat `owner_username` as an authorization identity populated from the trusted Hasura user claim; exclude it from normal user updates and reject deletion of configurations with children.
- **Reason:** the UI cannot establish ownership, unrestricted updates would permit ownership takeover, and the existing self-FK cascade could remove child configurations that are not owned by the deleting user.
- **Review input:** security, skeptic, and tester reviews independently identified forged-owner, update-takeover, and cascade risks. The architecture review did not return after repeated waits.
- **Impact on implementation:** metadata must restrict insert/delete/update paths, the migration must add a database-level child-delete guard, and tests must include direct authorization attempts rather than only UI behavior.

### 2026-09-16 - Close hierarchy and cache edge cases

- **Decision:** remove `model_configuration_id` from normal user insert/update permissions, remove `owner_username` from user select columns, and evict the deleted configuration from Apollo's normalized cache after refetching browse and ownership queries.
- **Reason:** QA found that non-owners could otherwise add/reparent child rows, blocking an owner's delete under the new restrictive FK, and that stale detail data could survive a successful delete.
- **Impact on implementation:** only root registrations are available to browser users; owner identity is never returned as a selectable field; and deleted detail entities cannot be rendered from the old normalized cache.

### 2026-09-16 - Use inline ownership operations until schema regeneration

- **Decision:** keep the new ownership operations in a small inline Apollo module while the committed Hasura schema snapshot still predates the migration.
- **Reason:** generated GraphQL artifacts must not be hand-edited, and the configured schema endpoint cannot be treated as migrated during this implementation session.
- **Deviation:** the canonical `.graphql` documents were updated for the next code-generation run, while the UI temporarily imports equivalent inline documents. Regenerate `graphql.ts` and `schema.graphql` after applying the database migration.

### 2026-09-16 - Implementation complete

- **Implemented:** added the ownership migration and Hasura permissions, stamped new registrations, added the authenticated My models query/filter and Yours badge, added owner-only delete confirmation/error handling, blocked parent deletion with children, and added focused UI tests plus README guidance.
- **Validation:** all 1,075 UI tests pass; focused ownership-related tests pass; typecheck, lint (existing warnings only), format check, build, metadata YAML parsing, and `git diff --check` pass. Live Hasura authorization tests and post-migration codegen remain deployment follow-ups.

## User feedback / decisions

Status is `Implemented`. The user approved this revised scope on 2026-09-16. The matching GitHub issues are [#213](https://github.com/mintproject/monorepo/issues/213) and [#212](https://github.com/mintproject/monorepo/issues/212). Before deployment, apply the migration/metadata and regenerate the committed GraphQL artifacts against the migrated Hasura schema.
