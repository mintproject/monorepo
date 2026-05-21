/**
 * MSW Node.js server instance for Vitest.
 *
 * The server is started/stopped/reset in src/test/setup.ts, which is
 * loaded as a Vitest setup file. Individual tests may add per-test
 * handlers via server.use(...) — these are reset after each test.
 */
import { setupServer } from 'msw/node';

import { handlers } from './handlers';

export const server = setupServer(...handlers);
