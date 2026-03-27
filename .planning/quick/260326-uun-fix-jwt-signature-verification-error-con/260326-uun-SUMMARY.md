---
phase: quick-260326-uun
plan: 01
subsystem: helm-charts/hasura
tags: [auth, hasura, tapis, webhook, jwt, helm]
dependency_graph:
  requires: []
  provides: [hasura-webhook-auth]
  affects: [hasura-deployment, hasura-auth-webhook-sidecar]
tech_stack:
  added: []
  patterns: [webhook-auth-sidecar, helm-conditional-blocks]
key_files:
  created: []
  modified:
    - helm-charts/charts/mint/values.yaml
decisions:
  - Switch auth type from jwt to webhook to use Tapis-compatible JWKS validation
  - Use portals.tapis.io tenant (not tacc.tapis.io) to match production token issuer
metrics:
  duration: 5 minutes
  completed: 2026-03-26
---

# Quick Task 260326-uun: Fix JWT Signature Verification Error Summary

**One-liner:** Switched Hasura auth from direct JWT verification to webhook sidecar mode with portals.tapis.io Tapis tenant URIs, eliminating the JWSInvalidSignature error on POST requests.

## Objective

Fix JWT signature verification error on POST requests to the model catalog API by switching Hasura from direct JWT verification to webhook-based authentication for Tapis tokens.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Switch Hasura auth from JWT to webhook with portals Tapis config | b2893f9 | helm-charts/charts/mint/values.yaml |
| 2 | Validate Helm template renders correctly with webhook auth | (verification only) | - |

## Changes Made

### helm-charts/charts/mint/values.yaml (commit b2893f9)

- `components.hasura.auth.type`: `jwt` -> `webhook`
- `components.hasura.auth.webhook.config.tapisJwksUri`: `https://tacc.tapis.io/v3/tenants/tacc` -> `https://portals.tapis.io/v3/tenants/portals`
- `components.hasura.auth.webhook.config.tapisTokenIssuer`: `https://tacc.tapis.io/v3/tokens` -> `https://portals.tapis.io/v3/tokens`

## Helm Template Validation

`helm template` confirmed the rendered output includes:

- `test-release-hasura-auth-webhook` Deployment and Service (webhook sidecar, rendered by the `{{- if eq .auth.type "webhook" }}` conditional)
- `HASURA_GRAPHQL_AUTH_HOOK` env var on the Hasura Deployment (not `HASURA_GRAPHQL_JWT_SECRET`)
- `TAPIS_JWKS_URI` and `TAPIS_TOKEN_ISSUER` env vars on the webhook container pointing to portals.tapis.io

## Deviations from Plan

None - plan executed exactly as written. The Helm template (hasura.yaml) already supported webhook auth mode; only values.yaml needed updating.

## Known Stubs

None.

## Self-Check: PASSED

- [x] helm-charts/charts/mint/values.yaml modified with webhook auth settings
- [x] Commit b2893f9 exists in helm-charts submodule
- [x] Helm template renders AUTH_HOOK (not JWT_SECRET) in webhook mode
- [x] portals.tapis.io URIs confirmed in rendered template
