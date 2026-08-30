BEGIN;

-- Drop the legacy model_id column from execution table.
-- The replacement column modelcatalog_configuration_id already exists,
-- is backfilled (migration 1771200012000), and has a FK constraint.
ALTER TABLE execution DROP COLUMN IF EXISTS model_id;

COMMIT;
