# Testing Patterns

**Analysis Date:** 2026-02-14

## Test Framework

**Runner:**
- Jest (v29.7.0 for mint-ensemble-manager, v24.1.0 for ui)
- Config: `jest.config.js` (mint-ensemble-manager), inline config in `package.json` (ui)

**Assertion Library:**
- Jest built-in assertions (expect, toEqual, toHaveBeenCalled, etc.)
- Supertest for HTTP testing (`npm install supertest @types/supertest`)
- jest-puppeteer for UI testing (in ui project)
- jest-axe for accessibility testing (in ui project)

**Run Commands:**
```bash
npm test                 # Run all tests
npm test:watch          # Run tests in watch mode (ui only)
jest                    # Run all tests (ensemble-manager)
```

**Environment Configuration:**
- mint-ensemble-manager requires: `ENSEMBLE_MANAGER_CONFIG_FILE=src/config/config.json jest`
- Test environment: `node` (not jsdom, unless testing browser code)

## Test File Organization

**Location:**
- Co-located with source in `__tests__` subdirectories
- Pattern 1: `src/classes/common/__tests__/ExecutionCreation.test.ts`
- Pattern 2: `src/api/api-v1/services/useModelService/useModelParameterService.test.ts`
- UI tests: `src/util/datacatalog/__tests__/ckan-data-catalog.test.ts`

**Naming:**
- `*.test.ts` for unit tests (primary pattern)
- `*.spec.ts` alternate pattern (less common)
- Integration tests: `.integration.test.ts` (e.g., `TACC_CKAN_Datacatalog.integration.test.ts`)
- Test directory: `__tests__` or `tests` subdirectories

**Test regex pattern:**
- `testRegex: [".*\\.test\\.ts$"]` in jest.config.js
- Also matches: `(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$` in ui jest config

## Test Structure

**Suite Organization:**
```typescript
describe("Execution Queue Router", () => {
    let app: express.Application;
    let mockExecutionQueueService: jest.Mocked<ExecutionQueueService>;

    beforeEach(() => {
        // Setup for each test
        app = express();
        app.use(express.json());
        mockExecutionQueueService = {
            getExecutionQueue: jest.fn(),
            emptyExecutionQueue: jest.fn()
        } as jest.Mocked<ExecutionQueueService>;
        app.use("/executionQueue", executionQueueRouter(mockExecutionQueueService));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("GET /executionQueue", () => {
        it("should return 202 with success result when service returns success", async () => {
            // Arrange
            const mockResult = { result: "success", data: { queue: [] } };
            mockExecutionQueueService.getExecutionQueue.mockResolvedValue(mockResult);

            // Act
            const response = await request(app).get("/executionQueue").expect(202);

            // Assert
            expect(response.body).toEqual(mockResult);
            expect(mockExecutionQueueService.getExecutionQueue).toHaveBeenCalledTimes(1);
        });
    });
});
```

**Patterns Observed:**
- `describe()` blocks for grouping related tests
- `beforeEach()` for test setup before each test
- `afterEach()` for cleanup (clearing mocks)
- Nested `describe()` blocks for organizing by HTTP methods or features
- Arrange-Act-Assert pattern within tests
- Comments marking each test phase: `// Arrange`, `// Act`, `// Assert`

## Mocking

**Framework:** Jest's built-in `jest.mock()` and `jest.fn()`

**Patterns:**

1. **Service Mocking:**
```typescript
jest.mock("@/classes/mint/model-catalog-functions", () => ({
    fetchCustomModelConfigurationOrSetup: jest.fn(),
    convertApiUrlToW3Id: jest.fn()
}));
```

2. **Module Mocking:**
```typescript
jest.mock("@/api/api-v1/services/executionQueueService");
```

3. **Function Mocking:**
```typescript
const mockService: jest.Mocked<ExecutionQueueService> = {
    getExecutionQueue: jest.fn(),
    emptyExecutionQueue: jest.fn()
} as jest.Mocked<ExecutionQueueService>;
```

4. **Mock Return Values:**
```typescript
mockExecutionQueueService.getExecutionQueue.mockResolvedValue(mockResult);
mockExecutionQueueService.getExecutionQueue.mockRejectedValue(new Error(errorMessage));
```

5. **Global Mocks:**
```typescript
(global as any).fetch = jest.fn();
jest.mock("config", () => ({
  MINT_PREFERENCES: { ... }
}));
```

**Verification:**
```typescript
expect(mockExecutionQueueService.getExecutionQueue).toHaveBeenCalledTimes(1);
expect(mockExecutionQueueService.getExecutionQueue).toHaveBeenCalledWith({});
```

**What to Mock:**
- External API calls and HTTP requests
- Database operations (via GraphQL queries)
- Configuration imports
- Service dependencies
- Express middleware

**What NOT to Mock:**
- Application request/response handling (test with real Express app)
- Error classes and custom exceptions
- Utility functions (test them directly)
- Internal business logic (only mock external boundaries)

## Fixtures and Factories

**Test Data Location:**
- `src/classes/common/__tests__/mocks/` directory (mint-ensemble-manager)
- Example files:
  - `getThreadMock.ts` - Mock Thread object
  - `getRegionMockTexas.ts` - Mock Region object
  - `MockExecutionService.ts` - Mock service implementation

**Fixture Pattern - UI Test:**
```typescript
const mockRegion: Region = {
  id: "test-region",
  name: "Test Region",
  category_id: "test-category",
  geometries: [],
  bounding_box: {
    xmin: -180,
    ymin: -90,
    xmax: 180,
    ymax: 90
  }
};

const mockDateRange: DateRange = {
  start_date: new Date("2020-01-01"),
  end_date: new Date("2020-12-31")
};
```

**Fixture Pattern - Ensemble Manager:**
```typescript
const bindingRequest: AddParametersRequest = {
    model_id: "http://api.models.mint.local/v1.8.0/...",
    parameters: [
        {
            id: "https://w3id.org/okn/i/mint/parameter1",
            value: "value1"
        }
    ]
};

const subtask: Thread = {
    id: "IBPfQmxbzJ3GseVKh7Hz",
    task_id: "FEUMjksoMJdsIseM44q4",
    // ... full object
};
```

**Location:**
- Inline in test files for simple objects
- Separate files in `__tests__/mocks/` for reusable fixtures
- Type-safe: objects match actual TypeScript types from source

## Coverage

**Requirements:** Not explicitly enforced

**View Coverage:**
```bash
npm test -- --coverage  # Generate coverage report (if configured)
```

**Coverage Provider:** `v8` (in mint-ensemble-manager jest.config.js)

**Current Coverage:**
- Not comprehensively tested - gaps exist (see CONCERNS.md)
- Test files found: ~13 test files across ensemble-manager and ui

## Test Types

**Unit Tests:**
- Scope: Individual functions and classes in isolation
- Approach: Mock all external dependencies
- Example: `useModelParameterService.test.ts` tests parameter binding logic with mocked catalog functions
- Location: Co-located with source files

**Integration Tests:**
- Scope: Multiple components working together
- Approach: Mock external services (APIs, databases) but test component interaction
- Example: `ExecutionCreation.test.ts`, `TACC_CKAN_Datacatalog.integration.test.ts`
- Pattern: Named with `.integration.test.ts` suffix

**Route/HTTP Tests:**
- Framework: Supertest for HTTP assertions
- Approach: Create real Express app with test routes, mock underlying services
- Example: `src/api/api-v1/paths/__tests__/executionQueue.test.ts`
```typescript
import request from "supertest";
import express from "express";
import executionQueueRouter from "../executionQueue";

app = express();
app.use(express.json());
app.use("/executionQueue", executionQueueRouter(mockService));

await request(app).get("/executionQueue").expect(202);
```

**E2E Tests:**
- Framework: jest-puppeteer (in ui project, minimal usage)
- Not extensively used in current codebase

## Common Patterns

**Async Testing:**
```typescript
it("should return 202 with success result", async () => {
    const mockResult = { result: "success", data: { queue: [] } };
    mockExecutionQueueService.getExecutionQueue.mockResolvedValue(mockResult);

    const response = await request(app).get("/executionQueue").expect(202);

    expect(response.body).toEqual(mockResult);
});
```

**Async with Promises:**
```typescript
return new Promise<any>((resolve, reject) => {
    rp.get({ url, json: true })
        .then((setups) => {
            if (found) {
                resolve(setup);
            } else {
                reject();
            }
        });
});
```

**Error Testing:**
```typescript
it("should return 500 when service throws an exception", async () => {
    const errorMessage = "Database connection failed";
    mockExecutionQueueService.getExecutionQueue.mockRejectedValue(
        new Error(errorMessage)
    );

    const response = await request(app).get("/executionQueue").expect(500);

    expect(response.body).toEqual({
        result: "error",
        message: errorMessage
    });
});
```

**Mock Clearing:**
```typescript
beforeEach(() => {
    jest.clearAllMocks();
    (convertApiUrlToW3Id as jest.Mock).mockReturnValue(modelW3Id);
});
```

**Type-Safe Mocks:**
```typescript
const mockExecutionQueueService: jest.Mocked<ExecutionQueueService> = {
    getExecutionQueue: jest.fn(),
    emptyExecutionQueue: jest.fn()
} as jest.Mocked<ExecutionQueueService>;
```

## TypeScript Configuration for Tests

**jest.config.js (mint-ensemble-manager):**
```javascript
const config = {
    coverageProvider: "v8",
    testRegex: [".*\\.test\\.ts$"],
    transform: {
        "\\.(gql|graphql)$": "@graphql-tools/jest-transform",
        ".*": "babel-jest"
    },
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1"
    }
};
```

**jest config in package.json (ui):**
```json
"jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "moduleNameMapper": {
        "^config$": "<rootDir>/src/config.ts",
        "^screens/(.*)$": "<rootDir>/src/screens/$1",
        "^util/(.*)$": "<rootDir>/src/util/$1"
    },
    "transform": {
        "^.+\\.tsx?$": "ts-jest"
    },
    "testRegex": "(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$"
}
```

**Transform Loaders:**
- `ts-jest` for TypeScript transformation
- `babel-jest` for JavaScript transformation
- `@graphql-tools/jest-transform` for GraphQL files

---

*Testing analysis: 2026-02-14*
