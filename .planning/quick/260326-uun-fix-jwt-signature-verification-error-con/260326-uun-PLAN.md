---
phase: quick-260326-uun
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - helm-charts/charts/mint/values.yaml
autonomous: true
requirements: [JWT-FIX-01]

must_haves:
  truths:
    - "Hasura uses webhook authentication instead of direct JWT verification"
    - "Webhook auth service is configured to validate Tapis tokens from portals.tapis.io"
    - "POST requests to model catalog API no longer return JWSInvalidSignature error"
  artifacts:
    - path: "helm-charts/charts/mint/values.yaml"
      provides: "Hasura auth configuration set to webhook mode with portals Tapis URIs"
      contains: "type: webhook"
  key_links:
    - from: "helm-charts/charts/mint/values.yaml"
      to: "helm-charts/charts/mint/templates/hasura.yaml"
      via: "Helm template conditionals on components.hasura.auth.type"
      pattern: "auth\\.type.*webhook"
---

<objective>
Fix JWT signature verification error on POST requests to the model catalog API by switching Hasura from direct JWT verification to webhook-based authentication for Tapis tokens.

Purpose: The current default values.yaml configures Hasura with `auth.type: jwt` and a JWT secret that does not match the Tapis token issuer (portals.tapis.io). The Helm template already supports webhook auth mode (hasura.yaml lines 221-234) which deploys a dedicated auth webhook sidecar that validates Tapis JWTs via JWKS. Switching to webhook mode resolves the JWSInvalidSignature error.

Output: Updated values.yaml with webhook auth enabled and correct Tapis portals URIs.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@helm-charts/charts/mint/values.yaml
@helm-charts/charts/mint/templates/hasura.yaml
@helm-charts/charts/mint/tapis.test.values.yaml
</context>

<tasks>

<task type="auto">
  <name>Task 1: Switch Hasura auth from JWT to webhook with portals Tapis config</name>
  <files>helm-charts/charts/mint/values.yaml</files>
  <action>
In helm-charts/charts/mint/values.yaml, update the `components.hasura.auth` section:

1. Change `type: jwt` to `type: webhook` (line 255)

2. Update the webhook config URIs to point to portals.tapis.io (matching the production Tapis tenant):
   - Change `tapisJwksUri` from `"https://tacc.tapis.io/v3/tenants/tacc"` to `"https://portals.tapis.io/v3/tenants/portals"`
   - Change `tapisTokenIssuer` from `"https://tacc.tapis.io/v3/tokens"` to `"https://portals.tapis.io/v3/tokens"`

Leave the `jwt` sub-section intact (it serves as documentation/fallback config). The Helm template in hasura.yaml already handles the webhook case:
- When type=webhook: deploys auth webhook sidecar pod + sets HASURA_GRAPHQL_AUTH_HOOK env var
- When type=jwt: uses HASURA_GRAPHQL_JWT_SECRET from secrets

Do NOT modify the Helm template (hasura.yaml) -- it already supports both auth modes correctly.
Do NOT modify tapis.test.values.yaml -- it is a test overlay file.
  </action>
  <verify>
    <automated>cd /Users/mosorio/repos/mint && grep -A 2 "type: webhook" helm-charts/charts/mint/values.yaml | head -3 && grep "portals.tapis.io" helm-charts/charts/mint/values.yaml</automated>
  </verify>
  <done>
    - components.hasura.auth.type is "webhook" (not "jwt")
    - tapisJwksUri points to "https://portals.tapis.io/v3/tenants/portals"
    - tapisTokenIssuer points to "https://portals.tapis.io/v3/tokens"
    - Helm template render would deploy auth webhook sidecar and set HASURA_GRAPHQL_AUTH_HOOK
  </done>
</task>

<task type="auto">
  <name>Task 2: Validate Helm template renders correctly with webhook auth</name>
  <files>helm-charts/charts/mint/values.yaml</files>
  <action>
Run helm template to verify the rendered output includes:
1. The hasura-auth-webhook Deployment and Service (only rendered when auth.type=webhook)
2. HASURA_GRAPHQL_AUTH_HOOK env var on the hasura Deployment (not HASURA_GRAPHQL_JWT_SECRET)
3. Correct TAPIS_JWKS_URI and TAPIS_TOKEN_ISSUER env vars on the webhook container

Use `helm template` with the chart directory. If helm is not available, use grep to verify the values.yaml changes are consistent with what the template expects:
- components.hasura.auth.type = "webhook" triggers the webhook conditional block
- components.hasura.auth.webhook.config.tapisJwksUri is referenced by template
- components.hasura.auth.webhook.config.tapisTokenIssuer is referenced by template
- components.hasura.auth.webhook.service.image.* are referenced for the webhook container
  </action>
  <verify>
    <automated>cd /Users/mosorio/repos/mint && helm template test-release helm-charts/charts/mint 2>/dev/null | grep -A 5 "HASURA_GRAPHQL_AUTH_HOOK" || (grep "type: webhook" helm-charts/charts/mint/values.yaml && grep "tapisJwksUri.*portals.tapis.io" helm-charts/charts/mint/values.yaml && grep "tapisTokenIssuer.*portals.tapis.io" helm-charts/charts/mint/values.yaml && echo "Values validated")</automated>
  </verify>
  <done>
    - Helm template renders auth webhook deployment when auth.type=webhook
    - OR: values.yaml fields are correct and consistent with template expectations
    - No HASURA_GRAPHQL_JWT_SECRET in rendered hasura deployment (webhook mode uses AUTH_HOOK instead)
  </done>
</task>

</tasks>

<verification>
- values.yaml has components.hasura.auth.type set to "webhook"
- Webhook config points to portals.tapis.io (not tacc.tapis.io)
- Helm template conditionals will deploy webhook sidecar and configure Hasura to use it
- JWT secret is no longer used for auth (webhook takes precedence in template)
</verification>

<success_criteria>
Hasura auth configuration switched from JWT to webhook mode with portals.tapis.io Tapis tenant URIs. On next helm upgrade, Hasura will validate Tapis tokens via the auth webhook instead of direct JWT verification, eliminating the JWSInvalidSignature error.
</success_criteria>

<output>
After completion, create `.planning/quick/260326-uun-fix-jwt-signature-verification-error-con/260326-uun-SUMMARY.md`
</output>
