# Coding Conventions

**Analysis Date:** 2026-02-14

## Naming Patterns

**Files:**
- Kebab-case for file names: `execution-queue.ts`, `model-catalog-functions.ts`, `ckan-data-catalog.ts`
- Service files: `*Service.ts` or `*Service` suffix (e.g., `executionsService`, `ExecutionQueueService`)
- Test files: `*.test.ts` or `*.spec.ts` (e.g., `ExecutionCreation.test.ts`, `jobs.test.ts`)
- GraphQL/Type definition files: `*-types.ts` or `mint-types.ts`
- Interface files: Start with `I` prefix (e.g., `IDatacatalog.ts`, `IExecutionService.ts`)
- Configuration files: `*-adapter.ts`, `*-config.ts` (e.g., `keycloak-adapter.ts`, `redis.ts`)

**Functions:**
- camelCase for function names: `fetchModelFromCatalog()`, `getConfiguration()`, `saveAndRunExecutions()`
- Async functions: Same camelCase convention (e.g., `submitExecution()`, `prepareExecutions()`)
- Service functions: Often exported as default objects with camelCase method names

**Variables:**
- camelCase for local variables and parameters: `response_variables`, `driving_variables`, `modelid`, `executionService`
- Constants: UPPER_SNAKE_CASE (e.g., `MAX_CONFIGURATIONS = 1000000`, `BATCH_SIZE = 500`)
- Underscore-prefixed for private/internal: `_getModelDetails()`

**Types:**
- PascalCase for interfaces and classes: `HttpError`, `NotFoundError`, `ExecutionCreation`, `CKANDataCatalog`
- Interface names: May start with `I` prefix in some cases (e.g., `IDatacatalog`, `IExecutionService`)
- Type definitions: PascalCase (e.g., `ModelConfiguration`, `Thread`, `Execution`)
- Enums and unions: PascalCase

**Directory:**
- Kebab-case for directory names: `api-v1`, `model-catalog`, `data-catalog`, `tapis`, `localex`
- Test directories: `__tests__` or `tests` subdirectories

## Code Style

**Formatting:**
- Prettier configuration at project root: `.prettierrc.yml` or `.prettierrc`
- Print width: 100 characters (mint-ensemble-manager)
- Tab width: 4 spaces (mint-ensemble-manager), 2 spaces (mint)
- Single quotes: false (use double quotes)
- Semicolons: true (required)
- Trailing commas: none (no trailing commas in multi-line)
- Bracket spacing: true (spaces inside braces)
- Bracket same line: false (closing bracket on new line)

**File formatting applied via:**
```bash
npm run prettier:fix      # Format code with Prettier
npm run eslint:fix        # Run ESLint and fix issues
```

**Linting:**
- ESLint configuration: `.eslintrc.js` or `.eslintrc.yml`
- Parser: `@typescript-eslint/parser` for TypeScript
- Extends: `eslint:recommended` + `plugin:@typescript-eslint/recommended`
- Environment: `browser: true, es2021: true` (with node environment in specific files)
- No custom rules enforced (empty rules object in base config)

## Import Organization

**Order (top to bottom):**
1. External dependencies (npm packages): `import express from "express"`
2. Type imports and interfaces: `import { HttpError } from "@/classes/common/errors"`
3. Local module imports: `import service from "@/api/api-v1/services/executionsService"`
4. GraphQL imports: `import { getThread } from "@/classes/graphql/graphql_functions"`
5. Config imports: `import { EXECUTION_QUEUE_NAME, REDIS_URL } from "@/config/redis"`
6. Utility imports: `import { createResponse } from "./util"`

**Path Aliases:**
- `@/api/*` → `src/api/*`
- `@/classes/*` → `src/classes/*`
- `@/config/*` → `src/config/*`
- `@/utils/*` → `src/utils/*`
- `@/interfaces/*` → `src/interfaces/*`

**Import style:**
- Named imports for multiple items: `import { HttpError, NotFoundError } from "@/classes/common/errors"`
- Default imports for services: `import executionsService from "@/api/api-v1/services/executionsService"`
- Destructuring for GraphQL functions: `import { getThread, getExecution } from "@/classes/graphql/graphql_functions"`

## Error Handling

**Custom Error Classes:**
Located in `src/classes/common/errors.ts`:
- `HttpError` - Base error class with statusCode and message
- `NotFoundError` - 404 errors
- `BadRequestError` - 400 errors
- `UnauthorizedError` - 401 errors
- `ForbiddenError` - 403 errors
- `InternalServerError` - 500 errors

**Error Handling Pattern:**
```typescript
try {
    const result = await service.submitExecution(req.body);
    if (result.result === "error") {
        res.status(406).json(result);
    } else {
        res.status(202).json(result);
    }
} catch (error) {
    res.status(500).json({ result: "error", message: error.message });
}
```

**Response Object Pattern:**
- Success: `{ result: "success", data: {...} }`
- Error: `{ result: "error", message: "...", [optional fields] }`
- Use `createResponse()` utility for consistent response formatting

**Throwing errors:**
- Throw custom error types: `throw new NotFoundError("Thread not found")`
- Include descriptive messages
- Errors propagate up to route handlers for HTTP response formatting

## Logging

**Framework:** `console` object (no dedicated logging framework detected)

**Patterns:**
- Use `console.log()` for informational messages
- Location: Throughout codebase in key business logic
- Example: `console.log("We found a matching model: " + calibid + ". Get details");`
- No structured logging format enforced
- No log levels enforced (info, warn, error distinction not consistently used)

## Comments

**When to Comment:**
- JSDoc comments for exported functions and classes
- Inline comments for complex logic or non-obvious implementations
- Comments above TODO items or workarounds

**JSDoc/TSDoc:**
- Used for API route documentation via `@swagger` tags
- Example from `src/api/api-v1/paths/executions.ts`:
```typescript
/**
 * @swagger
 * /executions:
 *   post:
 *     summary: Submit modeling thread for execution.
 *     operationId: submitExecution
 *     security:
 *       - BearerAuth: []
 *     ...
 */
router.post("/", async (req, res) => { ... });
```
- Swagger tags generate OpenAPI documentation automatically
- No strict JSDoc enforcement on non-route functions

## Function Design

**Size:** No strict limits enforced, but functions typically:
- Range from 5-50 lines for utility/service functions
- Route handlers: 5-20 lines (business logic delegated to services)
- Class methods: 10-40 lines

**Parameters:**
- Use destructuring for complex objects: `{ response_variables, driving_variables, modelid, prefs }`
- Limit to 5-6 parameters before considering object wrapping
- Request bodies passed as full objects: `req.body`

**Return Values:**
- Functions often return Promises for async operations: `Promise<ModelConfigurationSetup>`
- Service functions return result objects: `{ result: "success"|"error", data?: any, message?: string }`
- Resolving/Rejecting promises explicitly in Promise constructors

**Async/Await:**
- Route handlers use `async (req, res) => { ... }`
- Service methods are async: `async submitExecution(req.body)`
- Promises wrapped in constructors for callback-based APIs

## Module Design

**Exports:**
- Default exports for service objects: `export default executionsService`
- Named exports for classes and interfaces: `export class HttpError`, `export interface ExecutionQueueService`
- Mix of default and named exports in same file common

**Barrel Files:**
- Not consistently used
- Some utilities exported via barrel pattern (e.g., `util/index.ts` pattern not found)
- Typically direct imports from specific files

**Service Pattern:**
```typescript
// Service object with methods
const executionsService = {
    submitExecution: async (modelThread: ModelThread) => { ... },
    // other methods
};
export default executionsService;
```

**Router Pattern:**
```typescript
// Express router factory function
export default function (service: typeof executionsService) {
    const router = Router();
    router.post("/", async (req, res) => {
        const result = await service.submitExecution(req.body);
        // handle response
    });
    return router;
}
```

---

*Convention analysis: 2026-02-14*
