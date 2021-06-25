# graphql_schema

This repository contains the schema and metadata of the MINT GraphQL.

There are two types files:

- `sql/*.sql`: The files required to create the postgres database
- `hasura_metadata.json` Hasura metadata which is used to describe the exposed GraphQL API.

## How to run?

Edit the `.env` to change password and secret

Run the container using `docker-compose`

```bash
$ docker-compose up -d
```

Check the status

```bash
$ docker-compose ps
```


## Database schema

You must import the database schema and some example data (regions and variables)

```bash
cat hasura_metadata.json | docker-compose exec -T postgres psql -U postgres
#import sample regions
cat sql/all_regions.sql | docker-compose exec -T postgres psql -U postgres
#import variables
cat sql/intervention.sql | docker-compose exec -T postgres psql -U postgres
cat sql/variable.sql | docker-compose exec -T postgres psql -U postgres
```
