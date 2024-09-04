FROM hasura/graphql-engine:v2.10.2
RUN apt-get update && apt-get install -y \
    curl \
    postgresql-client-common \
    && rm -rf /var/lib/apt/lists/*
RUN curl -L https://github.com/hasura/graphql-engine/raw/stable/cli/get.sh | INSTALL_PATH=/usr/local/bin bash
RUN mkdir /hasura
COPY . hasura/
