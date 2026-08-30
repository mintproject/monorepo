---
name: test-on-k8s-dev
description: Deploy and test a submodule branch build on the shared MicroK8s development cluster (release `mint`, namespace `mint`) before opening a helm PR. Use when asked to test a change on Kubernetes, verify a fix on the dev instance, check whether a deployed image actually contains a change, or reach Hasura / the model catalog API running in-cluster.
---

# test-on-k8s-dev

How to exercise a change on the shared MicroK8s dev cluster. This is the gap between "CI is green" and "open a helm PR": CI proves the image builds, this proves it works against real data.

For local-only work use the `run-e2e-hasura` skill in `model-catalog-api/` instead. That runs against a local Hasura and needs no cluster.

## The cluster

Verified 2026-08-27:

| | |
|---|---|
| kubectl context | `microk8s` (cluster `microk8s-cluster`, node `pop-os`, k8s v1.31.14) |
| Namespace | `mint` (already the context default) |
| Helm release | `mint`, chart `MINT-9.0.0-beta.2` |

The cluster is remote, not on the laptop. `kubectl get nodes` is the fastest liveness check.

**Two stale names to ignore.** `helm-charts/README.md` documents installing the release as `testing-mint`, and `model-catalog-api/src/hasura/client.ts` defaults `HASURA_GRAPHQL_URL` to `http://testing-mint-hasura.mint.svc.cluster.local/v1/graphql`. Neither matches this cluster, where the release is `mint` and the in-cluster URL is `http://mint-hasura/v1/graphql`. Resource names are `mint-*`, not `testing-mint-*`.

## Component map

| Submodule | Deployment | Container | Service | Ingress host | Chart values key |
|---|---|---|---|---|---|
| `model-catalog-api` | `mint-model-catalog` | `model-catalog` | `mint-model-catalog:80` | `api.models.mint.local` | `components.model_catalog_api.image.tag` |
| `graphql_engine` | `mint-hasura` | | `mint-hasura:80` | `graphql.mint.local` | `components.hasura.image.tag` |
| `mint-ensemble-manager` | `mint-ensemble-manager` | | | `ensemble-manager.mint.local` | `components.ensemble_manager.image.tag` |
| `ui` (mint-ui-lit) | `mint-ui` | | | `mint.local` | `components.ui.image.tag` |

The `*.mint.local` hosts only resolve if the node IP is in your `/etc/hosts`. Port-forwarding avoids that entirely and is the better default for a quick check.

## Reaching a service without touching the cluster

```bash
kubectl port-forward -n mint svc/mint-model-catalog 18080:80 &
PF=$!
curl -s http://127.0.0.1:18080/health          # {"status":"ok","hasura":"connected"}
kill $PF
```

Read-only, safe on a shared cluster, and enough to characterise current behaviour before you change anything.

## Deploying a branch build

CI in `model-catalog-api` pushes on **every branch push**, so a branch image exists as soon as `build-and-push` is green — you do not need to merge to test:

- `ghcr.io/mintproject/model-catalog-api:<full-commit-sha>`
- `ghcr.io/mintproject/model-catalog-api:<branch-name-with-slashes-as-dashes>`
- `:latest` is only republished on `main`.

Confirm the image is really in the registry before deploying it:

```bash
TOKEN=$(curl -s "https://ghcr.io/token?scope=repository:mintproject/model-catalog-api:pull&service=ghcr.io" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.oci.image.index.v1+json" \
  "https://ghcr.io/v2/mintproject/model-catalog-api/manifests/<sha>"
```

`200` means present.

Then point the deployment at it. **This mutates a shared cluster — ask the user first.**

```bash
# note the current image so you can get back to it
kubectl get deploy -n mint mint-model-catalog \
  -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'

kubectl set image -n mint deploy/mint-model-catalog \
  model-catalog=ghcr.io/mintproject/model-catalog-api:<sha>
kubectl rollout status -n mint deploy/mint-model-catalog --timeout=120s
```

Revert when done:

```bash
kubectl rollout undo -n mint deploy/mint-model-catalog
```

Helm will also overwrite this on its next `helm upgrade`, so a forgotten `set image` is not permanent — but do not leave the shared instance on a branch build.

## Verifying the change is actually live

**A 200 with plausible data does not mean your change deployed.** `model-catalog-api` is a Fastify + `fastify-openapi-glue` service: AJV validates the querystring against the OpenAPI spec and **silently strips any query param the spec does not declare**. An unrecognised filter is dropped, the endpoint returns an unfiltered page, and the response looks fine.

Observed on the dev cluster against an image predating the change:

```
?label_contains=land_surface&per_page=3  -> evaporation_volume_flux_index,
                                            downstream_volume_flow_rate,
                                            land_region_water__..._index
?per_page=3                              -> evaporation_volume_flux_index,
                                            downstream_volume_flow_rate,
                                            land_region_water__..._index
```

Identical. The filter did nothing.

So always test a new param **differentially** — compare it against the same request without it, and confirm the results differ in the way you expect:

```bash
kubectl port-forward -n mint svc/mint-model-catalog 18080:80 &
PF=$!
BASE=http://127.0.0.1:18080/v2.0.0/standardvariables
lbl() { curl -s "$1" | python3 -c "import sys,json;print([x['label'][0] for x in json.load(sys.stdin)])"; }
lbl "$BASE?per_page=3"
lbl "$BASE?label_contains=land_surface&per_page=3"   # must differ, and all match
kill $PF
```

Two corollaries when adding a query param to this API:

1. Implementing it in `service.ts` is not enough. It must also be declared under the operation's `parameters:` in `openapi.yaml`, or it never reaches the handler.
2. A service-level unit test bypasses Fastify and will pass either way. Cover it with a route-level test (`app.inject`) too — see `src/__tests__/standardvariables-ckan-route.test.ts`.

## Where this fits

1. Push the branch, wait for CI (`gh pr checks <n>`).
2. Confirm the image is in GHCR.
3. Deploy it here and verify differentially (this skill).
4. Only then pin the SHA in helm and open the PR — via the `update-helm-image-tags` or `dynamo-bump-from-branch` skill.
