# mint-ensemble-manager

Ensemble Manager for MINT

## API Documentation

The MINT Ensemble Manager provides a comprehensive REST API for managing ensemble modeling workflows, including problem statements, tasks, subtasks, threads, and job execution.

### Base URL

**Production Server:**

```
https://ensemble-manager.mint.tacc.utexas.edu/v1
```

**Local Development:**

```
http://localhost:3000/v1
```

### Authentication

**⚠️ Security Notice**: The API requires JWT authentication. Include your JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

**Production Access**: The production server requires a TACC account for authentication. Use the client ID `mint-ensemble-manager` when authenticating.

### Interactive Documentation

Access the interactive Swagger UI documentation:

**Production:**

```
https://ensemble-manager.mint.tacc.utexas.edu/v1/ui
```

**Local Development:**

```
http://localhost:3000/v1/ui
```

### Core Concepts

#### Problem Statements

Problem statements define the high-level research questions and scope for your modeling work.

#### Tasks

Tasks represent specific modeling objectives within a problem statement, with defined time periods and regions.

#### Subtasks (formerly Threads)

Subtasks contain the actual model configurations, parameters, and data inputs for execution. **Note**: Subtasks were previously called "Threads" - all thread endpoints are now deprecated.

#### ~~Threads~~ (Deprecated)

**⚠️ DEPRECATED**: Thread endpoints are deprecated and will be removed soon. Use the Subtask endpoints instead.

### API Endpoints

#### Problem Statements

**Create a Problem Statement**

```http
POST /problem-statement
```

**Example Request:**

```json
{
    "name": "Texas Water Management Analysis 2024",
    "regionid": "texas",
    "dates": {
        "start_date": "2024-01-01T00:00:00Z",
        "end_date": "2024-12-31T23:59:59Z"
    },
    "events": [
        {
            "event": "CREATE",
            "userid": "user@example.com",
            "timestamp": "2024-01-15T10:30:00Z",
            "notes": "Initial problem statement creation"
        }
    ],
    "permissions": [
        {
            "userid": "*",
            "read": true,
            "write": false,
            "execute": false,
            "owner": false
        }
    ]
}
```

**List Problem Statements**

```http
GET /problem-statement
```

**Get Problem Statement by ID**

```http
GET /problem-statement/{id}
```

#### Tasks

**Create a Task**

```http
POST /task
```

**Example Request:**

```json
{
    "name": "Crop Yield Analysis Task",
    "dates": {
        "start_date": "2024-01-01T00:00:00Z",
        "end_date": "2024-12-31T23:59:59Z"
    },
    "response_variables": ["crop__potential_transpiration_volume_flux"],
    "driving_variables": ["nitrogen__average_of_net_mass_mineralization_rate"],
    "regionid": "ethiopia"
}
```

**Create Task and Subtask Together**

```http
POST /task-and-subtask
```

**Example Request:**

```json
{
    "task": {
        "name": "Crop Yield Analysis Task",
        "response_variables": ["crop__potential_transpiration_volume_flux"],
        "driving_variables": ["nitrogen__average_of_net_mass_mineralization_rate"],
        "regionid": "ethiopia",
        "dates": {
            "start_date": "2024-01-01T00:00:00Z",
            "end_date": "2024-12-31T23:59:59Z"
        }
    },
    "subtask": {
        "name": "Crop Yield Analysis Subtask",
        "driving_variables": ["nitrogen__average_of_net_mass_mineralization_rate"],
        "response_variables": ["crop__potential_transpiration_volume_flux"],
        "dates": {
            "start_date": "2024-01-01T00:00:00Z",
            "end_date": "2024-12-31T23:59:59Z"
        }
    }
}
```

**List Tasks**

```http
GET /task
```

**Get Task by ID**

```http
GET /task/{id}
```

#### Subtasks

**Create a Subtask**

```http
POST /subtask
```

**Add Models to Subtask**

```http
POST /subtask/{id}/models
```

**Example Request:**

```json
{
    "modelIds": [
        "http://api.models.mint.local/v1.8.0/modelconfigurations/modflow_2005_BartonSprings_avg?username=mint@isi.edu"
    ]
}
```

**Add Parameters to Subtask**

```http
POST /subtask/{id}/parameters
```

**Example Request:**

```json
{
    "model_id": "http://api.models.mint.local/v1.8.0/modelconfigurationsetups/c07a6f98-6339-4033-84b0-6cd7daca6284?username=mint%40isi.edu",
    "parameters": [
        {
            "id": "https://w3id.org/okn/i/mint/start_planting_day",
            "value": [100, 107, 114]
        },
        {
            "id": "https://w3id.org/okn/i/mint/nitrogen_application_rate",
            "value": "150"
        }
    ]
}
```

**Add Data to Subtask**

```http
POST /subtask/{id}/data
```

**Example Request:**

```json
{
    "model_id": "http://api.models.mint.local/v1.8.0/modelconfigurationsetups/c07a6f98-6339-4033-84b0-6cd7daca6284?username=mint%40isi.edu",
    "data": [
        {
            "id": "https://w3id.org/okn/i/mint/ce32097e-641d-42af-b3f1-477a24cf015a",
            "dataset": {
                "id": "18400624-423c-42b5-ad56-6c73322584bd",
                "resources": [
                    {
                        "id": "9c7b25c4-8cea-4965-a07a-d9b3867f18a9",
                        "url": "https://ckan.tacc.utexas.edu/dataset/18400624-423c-42b5-ad56-6c73322584bd/resource/9c7b25c4-8cea-4965-a07a-d9b3867f18a9/download/barton_springs_2001_2010average.wel"
                    }
                ]
            }
        }
    ]
}
```

**Setup Complete Model Configuration**

```http
POST /subtask/{id}/setup
```

This endpoint allows you to configure a model, parameters, and data inputs in a single call.

**List Subtasks**

```http
GET /subtask
```

**Get Subtask by ID**

```http
GET /subtask/{id}
```

#### Threads

**⚠️ DEPRECATED**: All thread endpoints are deprecated and will be removed soon. Use the Subtask endpoints instead.

**Create a Thread**

```http
POST /thread
```

**⚠️ DEPRECATED**: Use `POST /subtask` instead.

**Example Request:**

```json
{
    "name": "Model Run Thread",
    "modelid": "cycles-0.10.2-alpha-collection-oromia",
    "datasets": {
        "cycles_weather_soil": "ac34f01b-1484-4403-98ea-3a380838cab1"
    },
    "parameters": {
        "start_planting_day": [100, 107, 114]
    }
}
```

**List Threads**

```http
GET /thread
```

**⚠️ DEPRECATED**: Use `GET /subtask` instead.

**Get Thread by ID**

```http
GET /thread/{id}
```

**⚠️ DEPRECATED**: Use `GET /subtask/{id}` instead.

#### Job Execution

**Submit a Job**

```http
POST /job
```

**Example Request:**

```json
{
    "name": "bae0f0be6dbee791f1841c20f9903afc",
    "appId": "modflow-2005",
    "appVersion": "0.0.6",
    "fileInputs": [
        {
            "name": "bas6",
            "sourceUrl": "https://data.mint.isi.edu/files/sample-inputs-outputs/modflowInputs/BARTON_SPRINGS_2001_2010AVERAGE.ba6"
        }
    ],
    "nodeCount": 1,
    "coresPerNode": 1,
    "maxMinutes": 10,
    "archiveSystemId": "ls6",
    "execSystemId": "ls6",
    "execSystemLogicalQueue": "development"
}
```

**Get Job Status**

```http
GET /job/{id}
```

**Update Job Status**

```http
PUT /job/{id}/status
```

**List Jobs**

```http
GET /job
```

### Data Types

#### TimePeriod

```json
{
    "start_date": "2024-01-01T00:00:00Z",
    "end_date": "2024-12-31T23:59:59Z"
}
```

#### MintEvent

```json
{
    "event": "CREATE",
    "userid": "user@example.com",
    "timestamp": "2024-01-15T10:30:00Z",
    "notes": "Event description"
}
```

#### MintPermission

```json
{
    "userid": "*",
    "read": true,
    "write": false,
    "execute": false,
    "owner": false
}
```

### Error Handling

The API returns standard HTTP status codes:

-   `200` - Success
-   `201` - Created
-   `400` - Bad Request
-   `401` - Unauthorized
-   `404` - Not Found
-   `500` - Internal Server Error

Error responses include a JSON object with error details:

```json
{
    "error": "Error message",
    "details": "Additional error details"
}
```

### Rate Limiting

The API implements rate limiting to ensure fair usage. Check the response headers for rate limit information:

-   `X-RateLimit-Limit` - Request limit per window
-   `X-RateLimit-Remaining` - Remaining requests in current window
-   `X-RateLimit-Reset` - Time when the rate limit resets

### Webhooks

The API supports webhook notifications for job status changes. Configure webhooks in your job submission:

```json
{
    "subscriptions": [
        {
            "eventCategoryFilter": "JOB_NEW_STATUS",
            "description": "Job status notifications",
            "enabled": true,
            "deliveryTargets": [
                {
                    "deliveryMethod": "WEBHOOK",
                    "deliveryAddress": "https://your-webhook-endpoint.com/job-updates"
                }
            ]
        }
    ]
}
```

### Getting Started

1. **Obtain Authentication Token**: Get your JWT token from the authentication service.
2. **Create a Problem Statement**: Define your research scope
3. **Create Tasks**: Break down your problem into specific objectives
4. **Create Subtasks**: Configure models, parameters, and data (formerly called "threads")
5. **Submit Jobs**: Execute your modeling workflows
6. **Monitor Progress**: Track job status and results

### Support

For API support and questions:

-   **Production**: Interactive documentation: [https://ensemble-manager.mint.tacc.utexas.edu/v1/ui](https://ensemble-manager.mint.tacc.utexas.edu/v1/ui)
-   **Local Development**: Interactive documentation: `http://localhost:3000/v1/ui`
-   Check the logs for detailed error information
-   Ensure your JWT token is valid and not expired
-   **Production Access**: Requires a TACC account with client ID `mint-ensemble-manager`

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
