# MINT Model Catalog UI (React)

New React/TypeScript frontend for the MINT Model Catalog, replacing the legacy LitElement UI.

## Requirements

- Node 20+
- npm 10+

## Development

```bash
npm install
npm run dev        # http://localhost:5173
```

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
  -e HASURA_ENDPOINT=https://graphql.mint.isi.edu/v1/graphql \
  -e AUTH_CLIENT_ID=mint-local \
  -e ENSEMBLE_MANAGER_API=https://ensemble.mint.isi.edu \
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
| `AUTH_CLIENT_ID` | `mint-local` |
| `AUTH_REALM` | `` (Keycloak only) |
| `AUTH_PROVIDER` | `tapis` |
| `GOOGLE_MAPS_KEY` | (shared development key) |
| `DATA_CATALOG_API` | `https://data.mint.isi.edu` |
| `MODEL_CATALOG_API` | `https://api.models.mint.isi.edu/v1.8.0` |
| `ENSEMBLE_MANAGER_API` | omitted when unset |
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
