# Split the region dump into different files

regions=$(cat regions.txt)
for region in ${regions}
do
    echo "Splitting ${region}..."
    timestamp=$(date +%s%3N)
    echo ${timestamp}
    cat hasura/dev/region.sql | /home/mosorio/.cargo/bin/pg-dump2insert | grep -i ${region} | grep INSERT > seeds/${timestamp}_${region}_${timestamp}.sql
done