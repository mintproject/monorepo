FROM postgis/postgis:14-3.3

RUN apt-get -o Acquire::Check-Valid-Until=false update \
    && apt-get install -y --no-install-recommends postgresql-14-pgvector \
    && rm -rf /var/lib/apt/lists/*
