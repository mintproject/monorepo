#!/bin/bash

# Parse a backup from dev and restore it to prod

pushd hasura
for table in $(cat tables.txt); do
    echo ${table}
    cat dev/${table}.sql | /home/mosorio/.cargo/bin/pg-dump2insert | grep INSERT > dev_new/${table}.sql
done   
popd