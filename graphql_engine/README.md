# graphql_schema

This repository contains the schema and metadata of the MINT GraphQL.

## How to run?

### Prerequisites

1. Install the [Hasura CLI](https://hasura.io/docs/latest/migrations-metadata-seeds/migrations-metadata-setup/#step-1-install-the-hasura-cli)
2. Install MINT using Helm chart

### Run

Apply the metadata to the MINT GraphQL

```bash
$ export HASURA_GRAPHQL_ADMIN_SECRET=<admin-secret>
$ export HASURA_GRAPHQL_ENDPOINT=http://localhost:8080
$ hasura migrate apply
$ hasura metadata apply
```

Populate the database with the seed data

```bash
$ hasura seeds apply
```

## Database Migrations and Metadata Management

### Overview

This project uses Hasura's migration system to manage database schema changes and metadata. The system consists of:

- **Migrations** (`migrations/`): SQL files that modify the database schema
- **Metadata** (`metadata/`): YAML files that define Hasura's GraphQL schema and permissions
- **Seeds** (`seeds/`): SQL files that populate the database with initial data

### Common Workflow

1. **Create a migration** when you need to change the database schema:

   ```bash
   hasura migrate create add_new_column --database-name default
   ```

2. **Apply migrations** to update the database:

   ```bash
   hasura migrate apply
   ```

3. **Update metadata** to reflect schema changes in Hasura:

   ```bash
   hasura metadata apply
   ```

4. **Reload metadata** if you need to refresh the GraphQL schema:
   ```bash
   hasura metadata reload
   ```

### Troubleshooting Common Issues

#### "Field not found in type" Error

**Problem**: You get an error like `field 'dataset_id' not found in type: 'thread'` even though the column exists in the database.

**Cause**: The database schema has been updated (via migrations), but the Hasura metadata hasn't been updated to reflect the new column in the GraphQL schema.

**Solution**:

1. **Check if the column exists in the database**:

   ```sql
   \d thread;  -- PostgreSQL command to describe table
   ```

2. **Verify the migration was applied**:

   ```bash
   hasura migrate status
   ```

3. **Check if the column is included in metadata**:
   Look in `metadata/tables.yaml` for the table definition and ensure the column is listed in:

   - `insert_permissions.columns`
   - `select_permissions.columns`
   - `update_permissions.columns`

4. **Apply metadata changes**:

   ```bash
   hasura metadata apply
   ```

5. **Reload metadata if needed**:

   ```bash
   hasura metadata reload
   ```

6. **Restart Hasura service** (if running in Kubernetes):
   ```bash
   kubectl rollout restart deployment/mint-hasura
   ```

#### Metadata vs Database Schema Mismatch

**Problem**: Database schema and Hasura metadata are out of sync.

**Solution**:

1. **Export current metadata** to see what Hasura thinks the schema is:

   ```bash
   hasura metadata export
   ```

2. **Compare with your local metadata files** to identify discrepancies.

3. **Apply your local metadata**:

   ```bash
   hasura metadata apply
   ```

4. **If conflicts exist**, you may need to:
   - Reset metadata: `hasura metadata reset`
   - Re-apply your metadata: `hasura metadata apply`

### Important Notes

- **Always apply migrations before metadata**: Database schema changes must be applied before updating Hasura metadata
- **Metadata is the source of truth**: Hasura's GraphQL schema is generated from metadata, not directly from the database
- **Column permissions**: New columns must be explicitly added to permission configurations in metadata
- **Kubernetes deployments**: After metadata changes, you may need to restart the Hasura pod for changes to take effect

### File Structure

```
graphql_engine/
├── migrations/           # Database schema migrations
│   ├── 1662641297914_init/
│   ├── 1751375338869_add_dataset_id_subtask/
│   └── ...
├── metadata/            # Hasura metadata configuration
│   ├── tables.yaml      # Table definitions and permissions
│   ├── actions.yaml     # Custom actions
│   └── ...
├── seeds/               # Initial data population
└── config.yaml          # Hasura configuration
```

### Best Practices

1. **Version control**: Always commit both migrations and metadata changes together
2. **Testing**: Test migrations and metadata changes in a development environment first
3. **Backup**: Create database backups before applying migrations in production
4. **Documentation**: Document schema changes and their purpose
5. **Rollback plan**: Ensure migrations can be rolled back if needed
