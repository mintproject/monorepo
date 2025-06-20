# mint-ensemble-manager

Ensemble Manager for MINT

## Environment Variables

The following environment variables need to be configured:

## WARNING

Security has been activated for the API in version 6.0.0. This means that the API is now protected and requires a valid JWT to access.
If you are facing authorization issues, rollback to version 5.0.0.

### Authentication

-   `PUBLIC_KEY`: RSA public key in PEM format for JWT verification
-   `JWT_ALGORITHMS`: Comma-separated list of JWT algorithms (defaults to RS256)
-   `CLIENT_ID`: OAuth2 client ID for Swagger UI
-   `AUTHORIZATION_URL`: OAuth2 authorization URL for API documentation

### Server Configuration

-   `PORT`: Server port number (defaults to 3000)
-   `VERSION`: API version

### Redis Configuration

-   `REDIS_URL`: Redis connection URL for the job queues

## GraphQL Type Generation

This project uses GraphQL Code Generator to automatically generate TypeScript types from GraphQL queries and mutations.

### Prerequisites

The project includes the following GraphQL codegen dependencies:

-   `@graphql-codegen/cli`: Command-line interface for GraphQL Code Generator
-   `@graphql-codegen/client-preset`: Preset for generating TypeScript types
-   `@graphql-typed-document-node/core`: Type-safe GraphQL document nodes

### Generating Types

To generate TypeScript types from your GraphQL schema and operations:

```bash
npm run codegen
```

This command will:

1. Read your GraphQL schema
2. Process all `.graphql` files in the project
3. Generate TypeScript types in `src/classes/graphql/types.ts`
4. Create typed document nodes for type-safe GraphQL operations

### Using Generated Types

After running codegen, you can use the generated types in your code:

```typescript
import { ApolloQueryResult } from "@apollo/client";
import { Problem_Statement } from "./types";

// Define typed query result
interface ListProblemStatementsResult {
    problem_statement: Problem_Statement[];
}

// Use in Apollo Client queries
const result: ApolloQueryResult<ListProblemStatementsResult> = await client.query({
    query: listProblemStatementsGQL,
    fetchPolicy: "no-cache"
});
```

### GraphQL Files Structure

GraphQL queries and mutations are organized in the `src/classes/graphql/queries/` directory:

```
src/classes/graphql/queries/
├── problem-statement/
│   ├── list.graphql
│   ├── get.graphql
│   ├── new.graphql
│   └── update.graphql
├── task/
├── thread/
└── execution/
```

### Type Declaration

The project includes a type declaration file (`src/typings/graphql.d.ts`) that allows importing `.graphql` files directly:

```typescript
declare module "*.graphql" {
    import { DocumentNode } from "graphql";
    const Schema: DocumentNode;
    export = Schema;
}
```

## Setup

-   Configure MINT servers

```
edit src/config/config.json
```

-   Generate GraphQL types (if schema changed)

```
npm run codegen
```

-   Start node

```
npm start
```

-   Go to http://localhost:3000/v1/ui
