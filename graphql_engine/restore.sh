#!/bin/bash

# Parse a backup from dev and restore it to prod

pushd hasura
for table in $(cat tables.txt); do
    echo ${table}
    cat dev/${table}.sql | /home/mosorio/.cargo/bin/pg-dump2insert | grep INSERT > dev_new/${table}.sql
    cat dev_new/${table}.sql  |  kubectl exec -i --namespace mint-isi pods/mint-dev-hasura-8f4f687ff-z648t -c hasura-db -- psql -U hasura -d hasura
done   
popd