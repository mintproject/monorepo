BEGIN;

-- Model-output handoffs are server-owned. Catalog data objects remain
-- unowned, while objects created for a unified parent carry the execution
-- identity that the deferred-plan bind endpoint verifies.
ALTER TABLE adapter.data_object
    ADD COLUMN owner_execution_id TEXT,
    ADD COLUMN owner_model_child_id TEXT,
    ADD COLUMN owner_tenant TEXT;

ALTER TABLE adapter.workflow_plan
    ADD COLUMN orchestration_mode TEXT NOT NULL DEFAULT 'standard';

CREATE INDEX data_object_owner_execution_idx
    ON adapter.data_object (owner_execution_id);

COMMIT;
