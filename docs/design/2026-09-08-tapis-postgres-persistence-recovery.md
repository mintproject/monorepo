# Tapis PostgreSQL persistence and Hasura recovery

## Status

Implemented — persistence and recovery completed 2026-09-08.

## Objective

Persist the MINT dev database across pod restarts and restore the GraphQL schema required by the UI.

## User need

The deployed UI fails with `modelcatalog_configuration` missing from `query_root`.

## Current code/system summary

`deploy/tapis/register_mint_stack.py` deploys `postgres:16` without volume mounts. Live PostgreSQL initialized after Hasura started; Hasura now reports missing internal metadata tables. Read-only SQL inventory found only the `postgres` database, system tables, and `plpgsql`: no application data remains in this instance. The initial MINT migration requires PostGIS geometry types. The Hasura image includes migrations and metadata but does not apply them automatically. Installed Tapipy has an older volume schema than current Tapis documentation.

## Proposed design

Create a dedicated `mintdevpostgresdata` Tapis volume and mount it at `/var/lib/postgresql/data`, with `PGDATA=/var/lib/postgresql/data/pgdata`. Use a PostgreSQL 16 PostGIS image. Reuse the volume on future deployments; never delete it during pod recreation. Guard existing PostgreSQL pods against silently changing their data mount or PGDATA: initial migration must be performed deliberately after inventory/backup. Ensure volume readiness before deploying PostgreSQL, and PostgreSQL readiness before restarting Hasura.

For this recovery, confirm the database is still empty, stop Hasura, attach storage and use the PostGIS image while preserving credentials/network settings. Start PostgreSQL and then Hasura, apply the committed migrations and metadata, and verify anonymous model-catalog queries. Restart PostgreSQL and Hasura once more and verify schema/migration records remain. Preserve any unexpected existing data rather than overwriting it. Do not invent or import catalog records from another deployment.

## Files likely affected

- `deploy/tapis/register_mint_stack.py`
- `deploy/tapis/test_register_mint_stack.py`
- `docs/deploy/mint-dev-pods.md`
- This design spec
- DSO-Architecture `docs/services/mint-platform.md`

## API/schema changes

Tapis volume creation and PostgreSQL pod storage/image configuration. Apply existing MINT migrations and metadata; no new application schema design.

## Data flow

Tapis volume → PostgreSQL 16/PostGIS PGDATA → Hasura catalog and tracked MINT tables → UI GraphQL requests.

## Risks and tradeoffs

Dev downtime is necessary. Existing lost data cannot be reconstructed from an empty database; schema recovery is distinct from historical-data restoration. Tapis volume permissions and image availability require validation. Volume persistence is not a backup. NFS-backed storage may require permission handling. Never print secrets or full environment specifications. Image/volume changes on an existing nonempty database require a separate preservation path.

## Alternatives considered

Restarting Hasura alone leaves data ephemeral. Keeping plain PostgreSQL fails geometry migrations. Automatically attaching an empty volume to an existing populated database risks hiding its data, so deployment must fail closed for that transition.

## Test plan

Unit-test mount/PGDATA generation, volume reuse, create-on-not-found only, errors, and refusal of unsafe existing-storage transitions. Run redacted dry-run and Python syntax checks. Live checks: PostgreSQL/PostGIS readiness, all migrations applied, consistent metadata, anonymous configuration query succeeds, mounted PGDATA, and a PostgreSQL restart preserves database identity/schema.

## Documentation plan

Document volume ownership, mount/PGDATA, image, manual recovery and migration commands, persistence verification, and limitations of recovery without backups in the runbook and DSO service page.

## Rollout/rollback plan

Inspect live state before mutation. Create/reuse the dedicated volume, preserve current pod connection settings, configure persistence, recover schema, validate, and restart-test. Retain the volume on any failure. Roll back application image tags independently of database storage; never detach or delete the data volume as rollback. No GitHub push/PR is authorized by this task.

## Open questions

Whether a historical catalog backup exists is unknown; no application rows remain in the current PostgreSQL database. Resolve image availability and live mount format before mutation.

## Decisions

### 2026-09-08 — Recover only after persistence

- **Decision:** Add persistent storage first, then recover Hasura using existing migrations/metadata.
- **Reason:** Pod recreation otherwise loses the recovered database again.
- **Alternatives rejected:** Schema-only recovery on ephemeral storage.
- **User feedback:** “ok, should do that then recover it.”
- **Impact on implementation:** Local deployment fixes and authorized live dev volume/pod/database changes; no changes to unrelated SVO work.

### 2026-09-08 — Architecture and security review

- **Decision:** Proceed with confirmed-404 lookup handling, fail-closed PostgreSQL image/storage checks, disabled automated PostgreSQL recreation, bounded SQL readiness, protected backups, quiesced dependents, and explicit PostGIS verification.
- **Reason:** Reviewers identified broad lookup exception handling, destructive recreation, and image-only extension checks as risks.
- **Review limits:** Reviewers received concrete source excerpts and live inventory through the parent; they could not independently read local files.
- **Impact:** These safeguards are implemented in routine deployment or the one-time live recovery procedure. No new approval was needed within the user-approved dev recovery.

## User feedback / decisions

User approved adding PostgreSQL persistence and then recovery. Proceed without another approval request within this scope.
