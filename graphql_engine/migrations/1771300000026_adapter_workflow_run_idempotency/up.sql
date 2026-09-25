BEGIN;

-- A unified execution may retry the post-model adapter submission after a
-- network or gateway failure. Keep the adapter run keyed by the stable
-- orchestration idempotency key so a retry returns the original run instead
-- of registering and starting a second pipeline.
ALTER TABLE adapter.workflow_run
    ADD COLUMN idempotency_key TEXT,
    ADD CONSTRAINT workflow_run_idempotency_key_key UNIQUE (idempotency_key);

COMMIT;
