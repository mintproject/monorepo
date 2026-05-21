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
