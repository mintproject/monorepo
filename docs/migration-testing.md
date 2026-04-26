# Testing Hasura Migration Locally with Production Backup

## Prerequisites

- `kubectl` configured with access to the TACC production cluster
- Hasura CLI installed
- Python 3 with ETL dependencies

## Step 1: Backup Production Database

```bash
# Find the hasura-db pod
kubectl get pods -n mint -l app=mint-hasura-db

# Dump the production database
kubectl exec -n mint mint-hasura-db-0 -- pg_dump -U hasura -d hasura --no-owner --no-acl > production-backup.sql
```

## Step 2: Reset Local Hasura Database

```bash
NAMESPACE=mint

# Scale down hasura to release the DB connection
kubectl scale deployment mint-hasura -n $NAMESPACE --replicas=0

# Delete the hasura-db statefulset (keeps PVC by default)
kubectl delete statefulset mint-hasura-db -n $NAMESPACE

# Delete the PVC to wipe all data
kubectl delete pvc data-mint-hasura-db-0 -n $NAMESPACE

# Recreate the statefulset and PVC from helm
# NOTE: do NOT use --reuse-values — local values.yaml has changed
# (data-catalog disabled, tapis_webhook_base_url, dynamo-values.yaml).
# Pass the values file(s) you actually want applied:
helm upgrade mint ./helm-charts/charts/mint -n $NAMESPACE \
  -f ./helm-charts/charts/mint/values.yaml

# Wait for the new database pod to be ready
kubectl rollout status statefulset/mint-hasura-db -n $NAMESPACE --timeout=120s
```

## Step 3: Restore Production Backup

```bash
# Wait a few seconds for postgres to initialize, then restore
cat backups/production-backup.sql | kubectl exec -i -n $NAMESPACE mint-hasura-db-0 -- psql -U hasura -d hasura
```

## Step 4: Apply Migrations (schema + table merge only)

Migration `1771200012000` adds FK constraints referencing `modelcatalog_configuration`
rows. The ETL must populate that table first. Stop at `1771200011000`.

Skip metadata apply here — the metadata references FK constraints from later migrations
and will fail with inconsistent metadata errors. Apply metadata once at the end.

```bash
# Find the hasura pod
kubectl scale deployment mint-hasura -n $NAMESPACE --replicas=1
kubectl rollout status deployment/mint-hasura -n $NAMESPACE --timeout=120s

POD=$(kubectl get pod -n $NAMESPACE -l app=mint-hasura -o jsonpath='{.items[0].metadata.name}')

# Apply migrations through 1771200011000 (merge junction tables)
# This creates modelcatalog_configuration table but does NOT add FKs from thread_model/execution
kubectl exec -n $NAMESPACE $POD -- bash -c \
  "cd /hasura && hasura migrate apply --goto 1771200011000 --skip-update-check"
```

## Step 5: Run ETL Pipeline

Populates `modelcatalog_configuration` and related tables so FK constraints in the next step can succeed.

```bash
# Get hasura DB password from k8s secret
HASURA_PWD=$(kubectl get secret -n $NAMESPACE mint-hasura-secrets \
  -o jsonpath='{.data.password}' | base64 -d)

# Port-forward in background
kubectl port-forward -n $NAMESPACE svc/mint-hasura-db 5432:5432 &
PF_PID=$!
sleep 3

# ETL defaults are postgres/postgres/postgres — override for hasura DB
DB_NAME=hasura DB_USER=hasura DB_PASSWORD="$HASURA_PWD" \
  python3 etl/run.py --trig-path model-catalog-endpoint/data/model-catalog.trig --clear

kill $PF_PID
```

## Step 6: Apply Remaining Migrations (FK backfill + Phase 10)

```bash
# Apply remaining migrations:
#   1771200012000 - backfill thread_model/execution modelcatalog_configuration_id + FK constraints + drop public.model
#   1771200013000 - drop execution.model_id
#   1771200014000 - repoint execution_data_binding FK to modelcatalog_dataset_specification
kubectl exec -n $NAMESPACE $POD -- bash -c \
  "cd /hasura && hasura migrate apply --skip-update-check"

# Now apply metadata — all FK constraints exist
kubectl exec -n $NAMESPACE $POD -- bash -c \
  "cd /hasura && hasura metadata apply --skip-update-check && hasura metadata reload --skip-update-check"
```

## Step 7: Verify

```bash
# Check migration status
kubectl exec -n $NAMESPACE $POD -- bash -c \
  "cd /hasura && hasura migrate status --skip-update-check"

# Verify modelcatalog tables have data
kubectl exec -n $NAMESPACE mint-hasura-db-0 -- psql -U hasura -d hasura \
  -c "SELECT count(*) FROM modelcatalog_configuration;"

# Verify execution table no longer has model_id
kubectl exec -n $NAMESPACE mint-hasura-db-0 -- psql -U hasura -d hasura \
  -c "\d execution" | grep model_id
```
