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
$ hasura migrate apply
$ hasura metadata apply
```

Populate the database with the seed data

```bash
$ hasura seeds apply
```

