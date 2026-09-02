# MINT Model Catalog UI (React)

New React/TypeScript frontend for the MINT Model Catalog, replacing the legacy LitElement UI.

## Requirements

- Node 20+
- npm 10+

## Running locally

```bash
docker compose up -d   # from the repository root — Hasura, Postgres, the APIs
npm install
npm run dev            # http://localhost:3000
```

The committed `public/env-config.js` points at that compose stack: Hasura on
8080 and Ensemble Manager on 3001. Nothing else to configure — but the stack has
to be up, because without it every query fails. Local dev writing to production
by default is the thing this avoids.

The stack seeds regions and a model-catalog fixture, and no problem statements.
The modeling pages start empty; sign in and create one. Signing in works locally
— the compose auth webhook validates real Tapis tokens.

To browse TACC's public deployment instead of the stack, set `HASURA_ENDPOINT`
to `https://graphql.mint.tacc.utexas.edu/v1/graphql`, whose `anonymous` role
serves read-only queries and whose CKAN allows the `localhost` origin. Its
schema can lag this checkout's migrations, so a branch that adds one fails
against it.

**Where local configuration comes from.** `index.html` loads `/env-config.js`
before the app, and Vite serves `public/` as-is, so `window.__MINT_CONFIG__` is
always defined under `npm run dev`. The `import.meta.env.VITE_*` fallbacks in
`src/` are whole-object defaults that apply only when `window.__MINT_CONFIG__`
is *absent* — which locally it never is. **Setting a `VITE_*` variable in a
`.env` will not change the dev server.** Change `public/env-config.js` instead:

```bash
cp .env.example .env
$EDITOR .env
npm run config:local   # regenerates public/env-config.js from .env
```

`public/env-config.js` is tracked, so that overwrites a committed file; restore
the defaults with `git checkout -- public/env-config.js`. Editing it by hand is
equally fine — the `.env` route exists so the same key names work for local dev,
the container and Vercel.

`.env.example` documents every key. Two notes on the local defaults:

- **Signing in.** The identity provider allows one callback URL per client, so
  `http://localhost:3000/oauth2/callback` needs its own OAuth2 client id in
  `AUTH_CLIENT_ID`. `mint-localhost-3000` is that client, which is why the dev
  server must stay on port 3000. Anonymous browsing works without it; writes do
  not.
- **Model execution.** `ENSEMBLE_MANAGER_API` points at the stack's Ensemble
  Manager on 3001. Empty it and the thread pages switch execution off rather
  than calling a wrong host. `EXECUTION_ENGINE` must agree with whatever it
  points at: run submission posts to a different route per backend, so a wrong
  value reaches the wrong handler or none.

## Testing

```bash
npm test           # run once
npm run test:watch # watch mode
```

Requires Node 20+. If `npm test` fails with a `crypto.getRandomValues` error, switch to Node 20 (`nvm use 20` or set PATH to use `/opt/homebrew/opt/node@20/bin`).

## Build

```bash
npm run build      # outputs to dist/
```

## Container

```bash
docker build -t mintproject/mint-ui-react:dev .
docker run --rm -p 8080:80 \
  -e HASURA_ENDPOINT=http://graphql.mint.local/v1/graphql \
  -e AUTH_CLIENT_ID=mint-local \
  -e ENSEMBLE_MANAGER_API=http://ensemble-manager.mint.local \
  mintproject/mint-ui-react:dev
```

The entrypoint regenerates `/usr/share/nginx/html/env-config.js` from the
environment at startup via `scripts/generate-env-config.mjs` — the same module
Vercel runs at build time — so an endpoint can be changed by rolling the
container rather than rebuilding the image.

Configuration keys (each accepts a bare or `VITE_`-prefixed name; empty string
is treated as unset):

| Key | Default |
|-----|---------|
| `HASURA_ENDPOINT` | `http://graphql.mint.local/v1/graphql` |
| `AUTH_SERVER` | `https://portals.tapis.io` |
| `AUTH_CLIENT_ID` | `mint-localhost-3000` |
| `AUTH_REALM` | `` (Keycloak only) |
| `AUTH_PROVIDER` | `tapis` |
| `GOOGLE_MAPS_KEY` | (shared development key) |
| `DATA_CATALOG_API` | `https://ckan.tacc.utexas.edu` (CKAN REST API base, no `/api` suffix) |
| `DATA_CATALOG_BROWSE_URL` | `https://ckan.tacc.utexas.edu` (human-browsable catalog UI, iframe src) |
| `ENSEMBLE_MANAGER_API` | omitted when unset |
| `EXECUTION_ENGINE` | `localex` (`tapis` / `localex` / `wings` — the backend that Ensemble Manager runs) |
| `BRANDING` | `none` (`tacc` shows the TACC + UT Austin strip; the preset lives in `src/lib/branding.ts`) |
| `AUTH_CALLBACK_ORIGIN` | omitted when unset |
| `AUTH_PREVIEW_ORIGIN_ALLOWLIST` | omitted when unset |
| `WELCOME_MESSAGE` | omitted when unset |

Because the entrypoint writes into the nginx document root, the container does
not support a read-only root filesystem as-is.

## Code Generation

GraphQL types are generated from the Hasura schema:

```bash
npm run codegen
```

## Stack

- Vite 5 + React 18 + TypeScript (strict)
- Apollo Client 3 (GraphQL)
- Tailwind CSS + shadcn/ui
- React Router v6
- React Hook Form + Zod
- Vitest + React Testing Library

## License

[MIT](https://opensource.org/license/mit). Copyright (c) 2026 MINT.
See [LICENSE](LICENSE).
