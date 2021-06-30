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
container_name=$(docker-compose ps -q postgres)
#check if the variable is not null
echo ${container_name}
#import sample regions
cat sql/01_schema.sql | docker exec -i ${container_name} psql -U postgres
cat sql/all_regions.sql | docker exec -i ${container_name} psql -U postgres
#import variables
cat sql/intervention.sql | docker exec -i ${container_name} psql -U postgres
cat sql/variable.sql | docker exec -i ${container_name} psql -U postgres
```
