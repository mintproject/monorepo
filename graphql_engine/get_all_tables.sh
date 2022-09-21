#!/bin/bash

# Get all tables in a database
tables=$(jq -r '.tables[]'.table.name tables.json | grep -v region)
echo ${tables}

for table in ${tables}
do
    echo ${table}
    hasura seed create ${table} --from-table ${table} 
done
